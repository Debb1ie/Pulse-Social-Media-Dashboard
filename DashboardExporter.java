package com.pulse;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.*;

/**
 * Pulse Dashboard — Java Data Exporter
 *
 * Connects to the Python Flask API and exports:
 *   - analytics_report_<timestamp>.csv   (per-platform stats)
 *   - posts_export_<timestamp>.csv       (all posts)
 *   - dashboard_snapshot_<timestamp>.json (full JSON dump)
 *
 * Usage:
 *   javac -d out src/main/java/com/pulse/DashboardExporter.java
 *   java  -cp out com.pulse.DashboardExporter [--host localhost] [--port 5000] [--out ./exports]
 */
public class DashboardExporter {

    private static String host = "localhost";
    private static int    port = 5000;
    private static String outDir = "./exports";

    // ── tiny JSON parser (no external libs needed) ──────────────────────────
    // We use a minimal hand-rolled approach so this file stays self-contained.

    public static void main(String[] args) throws Exception {
        parseArgs(args);

        System.out.println("╔══════════════════════════════════════╗");
        System.out.println("║   Pulse Dashboard — Java Exporter    ║");
        System.out.println("╚══════════════════════════════════════╝");
        System.out.printf("  API:    http://%s:%d%n", host, port);
        System.out.printf("  Output: %s%n%n", outDir);

        Files.createDirectories(Paths.get(outDir));

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));

        System.out.println("[1/3] Fetching dashboard data...");
        String dashJson = httpGet("/api/dashboard");
        exportJson(dashJson, outDir + "/dashboard_snapshot_" + timestamp + ".json");
        System.out.println("      ✓ dashboard_snapshot_" + timestamp + ".json");

        System.out.println("[2/3] Exporting platform analytics CSV...");
        String platformsJson = httpGet("/api/platforms");
        exportPlatformsCsv(platformsJson, outDir + "/analytics_report_" + timestamp + ".csv");
        System.out.println("      ✓ analytics_report_" + timestamp + ".csv");

        System.out.println("[3/3] Exporting posts CSV...");
        String postsJson = httpGet("/api/posts");
        exportPostsCsv(postsJson, outDir + "/posts_export_" + timestamp + ".csv");
        System.out.println("      ✓ posts_export_" + timestamp + ".csv");

        System.out.println("\n  All exports saved to: " + Paths.get(outDir).toAbsolutePath());
        System.out.println("  Done! 🎉");
    }

    // ── HTTP GET ─────────────────────────────────────────────────────────────
    private static String httpGet(String path) throws Exception {
        URL url = new URL("http", host, port, path);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(10000);
        conn.setRequestProperty("Accept", "application/json");

        int status = conn.getResponseCode();
        if (status != 200) throw new IOException("API returned HTTP " + status + " for " + path);

        try (InputStream is = conn.getInputStream();
             BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            return br.lines().collect(Collectors.joining("\n"));
        }
    }

    // ── JSON DUMP ────────────────────────────────────────────────────────────
    private static void exportJson(String json, String filePath) throws IOException {
        Files.writeString(Paths.get(filePath), prettyJson(json), StandardCharsets.UTF_8);
    }

    // ── PLATFORMS CSV ────────────────────────────────────────────────────────
    private static void exportPlatformsCsv(String json, String filePath) throws IOException {
        String[] columns = {
            "Platform","Followers","Following","Posts","Engagement Rate (%)",
            "Reach","Impressions","Likes Total","Comments Total","Shares Total"
        };

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", columns)).append("\n");

        // Parse each platform block manually
        // JSON shape: { "twitter": {...}, "instagram": {...}, ... }
        String[] platformKeys = { "twitter","instagram","facebook","linkedin","youtube","tiktok" };
        for (String key : platformKeys) {
            String block = extractBlock(json, "\"" + key + "\"");
            if (block == null) continue;

            sb.append(csvField(capitalize(key))).append(",")
              .append(csvField(extractValue(block, "followers"))).append(",")
              .append(csvField(extractValue(block, "following"))).append(",")
              .append(csvField(extractValue(block, "posts_count"))).append(",")
              .append(csvField(extractValue(block, "engagement_rate"))).append(",")
              .append(csvField(extractValue(block, "reach"))).append(",")
              .append(csvField(extractValue(block, "impressions"))).append(",")
              .append(csvField(extractValue(block, "likes_total"))).append(",")
              .append(csvField(extractValue(block, "comments_total"))).append(",")
              .append(csvField(extractValue(block, "shares_total"))).append("\n");
        }

        Files.writeString(Paths.get(filePath), sb.toString(), StandardCharsets.UTF_8);
    }

    // ── POSTS CSV ────────────────────────────────────────────────────────────
    private static void exportPostsCsv(String json, String filePath) throws IOException {
        String[] columns = { "ID","Platform","Caption","Likes","Comments","Shares","Reach","Status","Timestamp" };

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", columns)).append("\n");

        // Posts is a JSON array; split by post objects
        List<String> objects = extractArrayObjects(json);
        for (String obj : objects) {
            sb.append(csvField(extractValue(obj, "id"))).append(",")
              .append(csvField(extractValue(obj, "platform"))).append(",")
              .append(csvField(stripQuotes(extractValue(obj, "caption")))).append(",")
              .append(csvField(extractValue(obj, "likes"))).append(",")
              .append(csvField(extractValue(obj, "comments"))).append(",")
              .append(csvField(extractValue(obj, "shares"))).append(",")
              .append(csvField(extractValue(obj, "reach"))).append(",")
              .append(csvField(stripQuotes(extractValue(obj, "status")))).append(",")
              .append(csvField(stripQuotes(extractValue(obj, "timestamp")))).append("\n");
        }

        Files.writeString(Paths.get(filePath), sb.toString(), StandardCharsets.UTF_8);
    }

    // ── MINIMAL JSON HELPERS ─────────────────────────────────────────────────

    /** Extracts the value string for a given key (works for string and number values). */
    private static String extractValue(String json, String key) {
        String search = "\"" + key + "\":";
        int idx = json.indexOf(search);
        if (idx == -1) return "";
        int start = idx + search.length();
        // skip whitespace
        while (start < json.length() && json.charAt(start) == ' ') start++;
        if (start >= json.length()) return "";
        char first = json.charAt(start);
        if (first == '"') {
            int end = json.indexOf('"', start + 1);
            return end == -1 ? "" : json.substring(start, end + 1);
        }
        // number / boolean / null: read until , or }
        int end = start;
        while (end < json.length() && json.charAt(end) != ',' && json.charAt(end) != '}' && json.charAt(end) != '\n') end++;
        return json.substring(start, end).trim();
    }

    /** Extracts the JSON object block following a given key. */
    private static String extractBlock(String json, String key) {
        int idx = json.indexOf(key);
        if (idx == -1) return null;
        int open = json.indexOf('{', idx + key.length());
        if (open == -1) return null;
        int depth = 0; int i = open;
        while (i < json.length()) {
            char c = json.charAt(i);
            if (c == '{') depth++;
            else if (c == '}') { depth--; if (depth == 0) return json.substring(open, i + 1); }
            i++;
        }
        return null;
    }

    /** Splits a top-level JSON array into individual object strings. */
    private static List<String> extractArrayObjects(String json) {
        List<String> result = new ArrayList<>();
        int i = json.indexOf('[');
        if (i == -1) return result;
        i++;
        while (i < json.length()) {
            if (json.charAt(i) == '{') {
                int depth = 0; int start = i;
                while (i < json.length()) {
                    char c = json.charAt(i);
                    if (c == '{') depth++;
                    else if (c == '}') { depth--; if (depth == 0) { result.add(json.substring(start, i + 1)); i++; break; } }
                    i++;
                }
            } else if (json.charAt(i) == ']') break;
            else i++;
        }
        return result;
    }

    private static String stripQuotes(String s) {
        if (s != null && s.startsWith("\"") && s.endsWith("\"")) return s.substring(1, s.length() - 1);
        return s == null ? "" : s;
    }

    private static String csvField(String v) {
        if (v == null) v = "";
        v = stripQuotes(v);
        if (v.contains(",") || v.contains("\"") || v.contains("\n")) {
            v = "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    /** Adds indentation to flat JSON for readability. */
    private static String prettyJson(String json) {
        StringBuilder sb = new StringBuilder();
        int indent = 0; boolean inString = false;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i-1) != '\\')) inString = !inString;
            if (inString) { sb.append(c); continue; }
            switch (c) {
                case '{': case '[': sb.append(c).append('\n').append("  ".repeat(++indent)); break;
                case '}': case ']': sb.append('\n').append("  ".repeat(--indent)).append(c); break;
                case ',': sb.append(c).append('\n').append("  ".repeat(indent)); break;
                case ':': sb.append(": "); break;
                default: if (c != ' ' && c != '\n' && c != '\r') sb.append(c);
            }
        }
        return sb.toString();
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static void parseArgs(String[] args) {
        for (int i = 0; i < args.length - 1; i++) {
            switch (args[i]) {
                case "--host": host = args[++i]; break;
                case "--port": port = Integer.parseInt(args[++i]); break;
                case "--out":  outDir = args[++i]; break;
            }
        }
    }
}

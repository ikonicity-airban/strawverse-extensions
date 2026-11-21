/**
 * StrawVerse Extension - YouTube Videos, Playlists & Courses
 * Copyright (C) 2026
 *
 * Enables search, streaming, and downloading of YouTube videos, full courses,
 * and multi-part educational playlists directly inside StrawVerse.
 * Powered by local high-speed extractor engine.
 */

const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

const YTDLP_BIN = path.join(process.env.APPDATA || "C:\\Users\\user-pc\\AppData\\Roaming", "strawverse", "bin", "yt-dlp.exe");
const NODE_BIN = "C:\\Program Files\\nodejs\\node.exe";

function runExtractor(args) {
    return new Promise((resolve, reject) => {
        execFile(YTDLP_BIN, args, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve(stdout);
        });
    });
}

/**
 * Search YouTube for videos, courses, or playlists.
 * Also supports directly pasting a YouTube video or playlist URL.
 */
async function SearchMovies(query, filters = 1) {
    if (!query || !query.trim()) return [];
    const q = query.trim();

    try {
        let args = [];
        if (q.includes("youtube.com/playlist") || q.includes("youtu.be/playlist") || q.startsWith("PL")) {
            const plUrl = q.startsWith("http") ? q : `https://www.youtube.com/playlist?list=${q}`;
            args = ["--flat-playlist", "--dump-json", plUrl];
        } else if (q.includes("youtube.com/watch") || q.includes("youtu.be/")) {
            args = ["--dump-json", q];
        } else {
            args = ["--flat-playlist", "--dump-json", `ytsearch18:${q}`];
        }

        const raw = await runExtractor(args);
        const lines = raw.trim().split("\n").filter(Boolean);

        return lines.map(line => {
            try {
                const item = JSON.parse(line);
                const isPlaylist = item._type === "playlist" || item.id?.startsWith("PL") || item.url?.includes("list=");
                const thumb = item.thumbnails?.[item.thumbnails.length - 1]?.url || (item.id ? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` : "");

                return {
                    id: item.id || item.url,
                    title: item.title || "YouTube Video",
                    image: thumb,
                    image_url: thumb,
                    description: item.description || (item.channel ? `Channel: ${item.channel}` : (item.uploader ? `By ${item.uploader}` : "")),
                    releaseDate: item.upload_date ? `${item.upload_date.slice(0, 4)}-${item.upload_date.slice(4, 6)}-${item.upload_date.slice(6, 8)}` : "",
                    released: item.upload_date || "",
                    type: isPlaylist ? "TV" : "Movie"
                };
            } catch (_) {
                return null;
            }
        }).filter(Boolean);
    } catch (err) {
        console.error("[YouTube Scraper] Search error:", err.message);
        return [];
    }
}

/**
 * Fetch detailed metadata and list all lectures/episodes for courses or playlists.
 */
async function MovieInfo(id) {
    if (!id) throw new Error("MovieInfo: id is required");

    try {
        const isPlaylist = id.startsWith("PL") || id.includes("list=") || id.length > 20;
        const targetUrl = id.startsWith("http") 
            ? id 
            : (isPlaylist ? `https://www.youtube.com/playlist?list=${id}` : `https://www.youtube.com/watch?v=${id}`);

        const args = ["--flat-playlist", "--dump-json", targetUrl];
        const raw = await runExtractor(args);
        const lines = raw.trim().split("\n").filter(Boolean);
        if (lines.length === 0) throw new Error("No video data found");

        if (lines.length === 1 && !isPlaylist) {
            const item = JSON.parse(lines[0]);
            const thumb = item.thumbnails?.[item.thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
            return {
                id: item.id,
                title: item.title,
                image: thumb,
                image_url: thumb,
                description: item.description || (item.channel ? `Channel: ${item.channel}` : ""),
                type: "Movie",
                status: "Completed",
                genres: ["Education", "YouTube"],
                episodes: [
                    {
                        id: item.id,
                        number: 1,
                        episode: 1,
                        season: 1,
                        title: item.title
                    }
                ]
            };
        }

        // Multi-episode Playlist or Course
        const episodes = [];
        let courseTitle = "YouTube Course / Playlist";
        let courseThumb = "";
        let courseDesc = "";

        lines.forEach((line, index) => {
            try {
                const item = JSON.parse(line);
                if (item.playlist_title && courseTitle === "YouTube Course / Playlist") {
                    courseTitle = item.playlist_title;
                }
                const thumb = item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
                if (!courseThumb) courseThumb = thumb;
                if (!courseDesc && item.channel) courseDesc = `Course by ${item.channel}`;

                episodes.push({
                    id: item.id,
                    number: index + 1,
                    episode: index + 1,
                    season: 1,
                    title: item.title || `Lecture ${index + 1}`
                });
            } catch (_) {}
        });

        return {
            id,
            title: courseTitle,
            image: courseThumb,
            image_url: courseThumb,
            description: courseDesc || `Complete course with ${episodes.length} video lectures.`,
            type: "TV",
            status: "Completed",
            genres: ["Education", "Course"],
            episodes
        };
    } catch (err) {
        console.error("[YouTube Scraper] MovieInfo error:", err.message);
        throw err;
    }
}

/**
 * Resolve direct high-definition playable stream URL for a given video/lecture.
 */
async function fetchMovieSources(combinedId) {
    if (!combinedId) return { sources: [], subtitles: [] };

    try {
        // Strip out any season/episode prefix if formatted as "id:path:se:ep"
        const vid = combinedId.includes(":") ? combinedId.split(":")[0] : combinedId;
        const targetUrl = vid.startsWith("http") ? vid : `https://www.youtube.com/watch?v=${vid}`;

        const args = [
            "--js-runtimes", `node:${NODE_BIN}`,
            "-g",
            "-f", "22/18/b[ext=mp4]/best",
            targetUrl
        ];

        const raw = await runExtractor(args);
        const streamUrl = raw.trim().split("\n")[0];
        if (!streamUrl) throw new Error("Could not extract stream URL");

        return {
            sources: [
                {
                    url: streamUrl,
                    quality: "720p",
                    isM3U8: streamUrl.includes(".m3u8")
                }
            ],
            subtitles: []
        };
    } catch (err) {
        console.error("[YouTube Scraper] fetchMovieSources error:", err.message);
        return { sources: [], subtitles: [] };
    }
}

/**
 * Discover feed showing featured educational courses and popular topics.
 */
async function latestMovies(filters = {}) {
    return SearchMovies("Complete Coding Course Playlist", filters);
}

module.exports = {
    name: "youtube",
    version: "1.0.0",
    baseUrl: "https://www.youtube.com",

    headerRules: [
        {
            match: ["googlevideo.com", "youtube.com", "ytimg.com"],
            headers: {
                "Origin": "https://www.youtube.com",
                "Referer": "https://www.youtube.com/"
            }
        }
    ],

    subrequestHeaders: [
        {
            match: ["googlevideo.com", "youtube.com"],
            headers: {
                "Origin": "https://www.youtube.com",
                "Referer": "https://www.youtube.com/"
            }
        }
    ],

    SearchMovies,
    MovieInfo,
    fetchMovieSources,
    latestMovies,

    SearchAnime: SearchMovies,
    AnimeInfo: MovieInfo,
    fetchEpisodeSources: fetchMovieSources,
    fetchRecentEpisodes: latestMovies
};

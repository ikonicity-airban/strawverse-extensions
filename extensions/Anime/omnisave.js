/**
 * StrawVerse Extension - OmniSave Movies & TV Shows
 * Copyright (C) 2026
 *
 * Scrapes and streams movies and TV series from OmniSave (videodownloader.site).
 * Fully compliant with StrawVerse Extension Specification.
 */

const BASE_API = "https://h5-api.aoneroom.com";
const BASE_SITE = "https://videodownloader.site";

// Permanent valid guest JWT session token (ensures 100% reliable auth inside Electron adapters)
const DEFAULT_GUEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjI2MzMzMjY4MzI1NTY4NjA1MTIsImF0cCI6MywiZXh0IjoiMTc5NTI0MzE2OCIsImV4cCI6MTgwMzAxOTE2OCwiaWF0IjoxNzk1MjQyODY4fQ.Ra676cOMZd-8gkccujFOwL8FMOrDKnt2JAVkWOjX7JQ";

let cachedToken = DEFAULT_GUEST_TOKEN;

const defaultHeaders = {
    "X-Source": "downloader",
    "X-Site-Domain": "videodownloader.site",
    "x-request-lang": "en",
    "Origin": BASE_SITE,
    "Referer": `${BASE_SITE}/`,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Universal request wrapper with retry logic
 */
async function httpRequest(url, options = {}, retries = 3) {
    const method = options.method || "GET";
    const headers = options.headers || {};
    const body = options.body;

    try {
        if (typeof global.axios === "function") {
            const res = await global.axios({
                url,
                method,
                headers,
                data: body,
                timeout: options.timeout || 15000
            });
            return { data: res.data, headers: res.headers || {} };
        }

        const fetchHeaders = { ...headers };
        if (body && typeof body === "object" && !fetchHeaders["Content-Type"]) {
            fetchHeaders["Content-Type"] = "application/json";
        }

        const fetchOptions = {
            method,
            headers: fetchHeaders,
            body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
            signal: options.timeout ? AbortSignal.timeout(options.timeout) : undefined
        };

        const res = await fetch(url, fetchOptions);
        const data = await res.json().catch(() => ({}));
        const resHeaders = {};
        if (res.headers && typeof res.headers.forEach === "function") {
            res.headers.forEach((val, key) => {
                resHeaders[key.toLowerCase()] = val;
            });
        }
        return { data, headers: resHeaders };
    } catch (err) {
        if (retries > 0) {
            const waitTime = (4 - retries) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return httpRequest(url, options, retries - 1);
        }
        throw err;
    }
}

/**
 * Obtain or reuse a valid guest JWT session token.
 */
async function getAuthToken() {
    if (cachedToken) {
        return cachedToken;
    }

    try {
        const res = await httpRequest(`${BASE_API}/wefeed-h5api-bff/country-code`, {
            method: "GET",
            headers: defaultHeaders,
            timeout: 8000
        });

        const rawUser = res.headers?.["x-user"] || (typeof res.headers?.get === "function" ? res.headers.get("x-user") : null);
        if (rawUser) {
            const parsed = typeof rawUser === "string" ? JSON.parse(rawUser) : rawUser;
            if (parsed?.token) {
                cachedToken = parsed.token;
                return cachedToken;
            }
        }
    } catch (_) {}

    cachedToken = DEFAULT_GUEST_TOKEN;
    return cachedToken;
}

/**
 * Search movies, series, and TV shows.
 * @param {string} query Search keyword
 * @param {number|object} [filters=1] Page number or filters object
 * @returns {Promise<Array<{ id: string, title: string, image: string, description: string }>>}
 */
async function SearchMovies(query, filters = 1) {
    if (!query || !query.trim()) {
        return [];
    }

    const page = typeof filters === "number" ? filters : (filters?.page || 1);

    try {
        const token = await getAuthToken();
        const payload = {
            keyword: query.trim(),
            page: page,
            perPage: 18
        };

        const res = await httpRequest(`${BASE_API}/wefeed-h5api-bff/subject/search`, {
            method: "POST",
            headers: {
                ...defaultHeaders,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: payload,
            timeout: 15000
        });

        const items = res.data?.data?.items || res.data?.items || [];
        return items.map(item => ({
            id: item.detailPath,
            title: item.title,
            image: item.cover?.url || "",
            image_url: item.cover?.url || "",
            description: item.description || (item.genre ? `Genre: ${item.genre}` : ""),
            releaseDate: item.releaseDate || "",
            released: item.releaseDate || "",
            type: item.subjectType === 2 ? "TV" : "Movie"
        }));
    } catch (err) {
        console.error("[OmniSave] SearchMovies error:", err.message);
        return [];
    }
}

/**
 * Fetch detailed movie or TV show metadata and episodes.
 * @param {string} detailPath Unique path identifier
 */
async function MovieInfo(detailPath) {
    if (!detailPath) {
        throw new Error("MovieInfo: detailPath is required");
    }

    try {
        const token = await getAuthToken();
        const res = await httpRequest(`${BASE_API}/wefeed-h5api-bff/detail?detailPath=${encodeURIComponent(detailPath)}`, {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Authorization": `Bearer ${token}`
            },
            timeout: 15000
        });

        const data = res.data?.data || {};
        const subject = data.subject || {};
        const resource = data.resource || {};
        const subjectId = subject.subjectId || "";
        const episodes = [];

        // Check seasons in resource
        if (Array.isArray(resource.seasons) && resource.seasons.length > 0) {
            for (const season of resource.seasons) {
                const se = season.se || 0;
                const maxEp = season.maxEp || 0;
                if (maxEp > 0) {
                    for (let ep = 1; ep <= maxEp; ep++) {
                        episodes.push({
                            id: `${subjectId}:${detailPath}:${se}:${ep}`,
                            number: ep,
                            episode: ep,
                            season: se,
                            title: `Season ${se} Episode ${ep}`
                        });
                    }
                } else {
                    episodes.push({
                        id: `${subjectId}:${detailPath}:${se}:0`,
                        number: 1,
                        episode: 1,
                        season: se,
                        title: subject.title || "Full Movie"
                    });
                }
            }
        }

        // Fallback if no episodes created
        if (episodes.length === 0) {
            episodes.push({
                id: `${subjectId}:${detailPath}:0:0`,
                number: 1,
                episode: 1,
                season: 0,
                title: subject.title || "Full Movie"
            });
        }

        const genres = typeof subject.genre === "string" 
            ? subject.genre.split(",").map(g => g.trim()).filter(Boolean)
            : [];

        const year = subject.releaseDate ? parseInt(subject.releaseDate.slice(0, 4), 10) : undefined;

        return {
            id: detailPath,
            title: subject.title || "",
            image: subject.cover?.url || "",
            image_url: subject.cover?.url || "",
            description: subject.description || "",
            type: subject.subjectType === 2 ? "TV" : "Movie",
            genres: genres,
            status: "Completed",
            year: year,
            aired: subject.releaseDate || "",
            released: subject.releaseDate || "",
            episodes: episodes
        };
    } catch (err) {
        console.error("[OmniSave] MovieInfo error:", err.message);
        throw err;
    }
}

/**
 * Fetch video stream sources and subtitles.
 * @param {string} combinedId Encoded as "subjectId:detailPath:season:episode"
 */
async function fetchMovieSources(combinedId) {
    if (!combinedId) {
        return { sources: [], subtitles: [] };
    }

    try {
        const parts = combinedId.split(":");
        const subjectId = parts[0] || "";
        const detailPath = parts[1] || "";
        const se = parts[2] || "0";
        const ep = parts[3] || "0";

        const token = await getAuthToken();
        const url = `${BASE_API}/wefeed-h5api-bff/subject/download?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${encodeURIComponent(detailPath)}&supportCodecs%5Bh264%5D=1`;

        const res = await httpRequest(url, {
            method: "GET",
            headers: {
                ...defaultHeaders,
                "Authorization": `Bearer ${token}`
            },
            timeout: 15000
        });

        const data = res.data?.data || {};
        const downloads = Array.isArray(data.downloads) ? data.downloads : [];
        const captions = Array.isArray(data.captions) ? data.captions : [];

        const sources = downloads
            .filter(d => d.url && !d.vipLocked)
            .map(d => ({
                url: d.url,
                quality: d.resolution ? `${d.resolution}p` : "HD",
                isM3U8: String(d.url).includes(".m3u8")
            }));

        const subtitles = captions
            .filter(c => c.url)
            .map(c => ({
                url: c.url,
                lang: c.lanName || c.lan || "English"
            }));

        return {
            sources,
            subtitles
        };
    } catch (err) {
        console.error("[OmniSave] fetchMovieSources error:", err.message);
        return { sources: [], subtitles: [] };
    }
}

/**
 * Discover / Latest releases feed for StrawVerse home view.
 */
async function latestMovies(filters = {}) {
    try {
        const token = await getAuthToken();
        const payload = {
            keyword: "2024",
            page: filters?.page || 1,
            perPage: 18
        };

        const res = await httpRequest(`${BASE_API}/wefeed-h5api-bff/subject/search`, {
            method: "POST",
            headers: {
                ...defaultHeaders,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: payload,
            timeout: 15000
        });

        const items = res.data?.data?.items || res.data?.items || [];
        return items.map(item => ({
            id: item.detailPath,
            title: item.title,
            image: item.cover?.url || "",
            image_url: item.cover?.url || "",
            description: item.description || (item.genre ? `Genre: ${item.genre}` : ""),
            releaseDate: item.releaseDate || "",
            released: item.releaseDate || "",
            type: item.subjectType === 2 ? "TV" : "Movie"
        }));
    } catch (err) {
        console.error("[OmniSave] latestMovies error:", err.message);
        return [];
    }
}

module.exports = {
    name: "omnisave",
    version: "1.0.1",
    baseUrl: BASE_SITE,

    // Declarative header rules for streaming playback in MPV / StrawVerse
    headerRules: [
        {
            match: ["hakunaymatata.com", "aoneroom.com", "videodownloader.site"],
            headers: {
                "Referer": `${BASE_SITE}/`,
                "Origin": BASE_SITE
            }
        }
    ],

    subrequestHeaders: [
        {
            match: ["hakunaymatata.com", "aoneroom.com"],
            headers: {
                "Referer": `${BASE_SITE}/`,
                "Origin": BASE_SITE
            }
        }
    ],

    // Movie Scraper Interface
    SearchMovies,
    MovieInfo,
    fetchMovieSources,
    latestMovies,

    // Backward-compatible Anime Scraper Interface aliases
    SearchAnime: SearchMovies,
    AnimeInfo: MovieInfo,
    fetchEpisodeSources: fetchMovieSources,
    fetchRecentEpisodes: latestMovies
};

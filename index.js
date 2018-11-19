let soundRoot = "";

Vue.component("play-button", {
	props: ["track"],
	template: `<el-button v-on:click="$emit('play', track)">{{ track.title }}</el-button>`
});

let nullTrack = { title: null, path: "" };

Vue.component("player", {
	props: ["volume"],
	watch: {
		volume: function (newVol) {
			this.$refs.audio.volume = newVol;
		}
	},
	methods: {
		play: function (track) {
			this.$refs.audio.src = "";
			this.$refs.audio.src = soundRoot + track.path;
			this.$refs.audio.play();
		},
		stop: function () {
			this.$refs.audio.src = "";
		}
	},
	template: `<audio ref="audio" id="audioplayer"></audio>`,
});

Vue.component("stop-button", {
	template: `<el-button type="danger" plain circle v-on:click="$emit('stop')">とめる</el-button>`
});

async function init() {
	let app = new Vue({
		el: "#app",
		data: {
			tracks: [],
			categories: {},
			archives: {},
			archiveInfo: {},
			track: nullTrack,
			volume: 0.5,
			lastModified: null
		},
		methods: {
			play: function (track) {
				this.track = track;
				this.$refs.player.play(track);
			},
			stopButtonClicked: function () {
				this.$refs.player.stop();
			}
		}
	});
	window.app = app;

	let response = await fetch("./contents.json");
	let trackdata = await response.json();
	let categories = {};
	let archives = {};
	
	let archiveInfoArray = Array.from(new Map(Object.entries(trackdata.archiveInfo)));
	archiveInfoArray.sort((a, b) => {
		if (a[1].date < b[1].date) return 1;
		if (a[1].date > b[1].date) return -1;
		return 0;
	});
	for (let e of archiveInfoArray) {
		archives[e[0]] = [];
	}
	archives["unknown"] = [];

	for (let e of trackdata.tracks) {
		let category = e.tags[0];
		if (category == "その他") continue;
		if (categories[category] == undefined) {
			categories[category] = [];
		}
		categories[category].push(e);

		// アーカイブごと
		let src = e.source;
		let videoId = src != null ? getVideoIdByURL(src) : null;
		if (videoId != null) {
			if (archives[videoId] == undefined) {
				archives[videoId] = [];
			}
			archives[videoId].push(e);
		} else {
			archives["unknown"].push(e);
		}
	}
	app.categories = categories;
	app.archives = archives;
	app.archiveInfo = trackdata.archiveInfo;
	app.lastModified = new Date(response.headers.get("Last-Modified")).toLocaleString("ja-JP");
	soundRoot = trackdata.soundRoot;
}

function getQueryMapByQueryString(qs) {
	let qarray = qs.split("&");
	let qmap = qarray.reduce((map, s) => {
		let kv = s.split("=");
		map.set(kv[0], kv[1]);
		return map;
	}, new Map());
	return qmap;
}

function getVideoIdByURL(url) {
	// https://youtu.be/<videoid>?t=<time>
	// https://www.youtube.com/watch?v=<videoid>&t=<time>
	if (url == null) return null;
	let regex_url = new RegExp('^https?://(.*?)(\\:\\d{1,5})?/(.*?)(\\?.*?)?$');
	let found = url.match(regex_url);
	if (found == null) return null;
	
	let domain = found[1];

	let result = null;

	switch (domain) {
		case "youtube.com":
		case "www.youtube.com":
			let query = found[4].slice(1);
			let qmap = getQueryMapByQueryString(query);
			result = "YT:" + qmap.get("v");
			break;
		case "youtu.be":
			result = "YT:" + found[3];
			break;
		case "www.showroom-live.com":
			result = "SR";
			break;
		default:
			result = null;
			break;
	}
	return result;
}
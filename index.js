let soundRoot = "";

Vue.component("play-button", {
	props: ["track"],
	template: `<el-button v-on:click="$emit('play', track)" v-bind:id="track.id">{{ track.title }}</el-button>`
});

let nullTrack = { id: null, title: null, path: "" };

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

Vue.component("favorite-button", {
	props: ["favorited"],
	template: `<img v-on:click="click" v-bind:src="favorited ? 'favorited.png' : 'unfavorited.png'" style="width: 1em; height:1em;"></img>`,
	methods: {
		click: function (e) {
			this.$emit("clicked");
		}
	}
});

async function init() {
	let app = new Vue({
		el: "#app",
		data: {
			tracks: {},
			categories: {},
			archives: {},
			archiveInfo: {},
			favorites: [],
			track: nullTrack,
			volume: 0.5,
			lastModified: null,
			isFavorited: false
		},
		methods: {
			play: function (track) {
				this.track = track;
				let isFavorited = this.track.isFavorited;
				this.isFavorited = isFavorited == undefined ? false : isFavorited;

				this.$refs.player.play(track);
			},
			stopButtonClicked: function () {
				this.$refs.player.stop();
			},
			favoriteButtonClicked: function () {
				let newState = !this.isFavorited;
				this.isFavorited = newState;
				this.track.isFavorited = newState;

				// localStorageの更新
				if (newState) {
					// add
					this.favorites.push(this.track.id);
				} else {
					// delete
					this.favorites.forEach((e, i) => {
						if (e == this.track.id) {
							this.favorites.splice(i, 1);
						}
					});
				}
				window.localStorage.setItem("favorited", JSON.stringify(this.favorites));
			}
		}
	});
	window.app = app;

	// データのロード
	let response = await fetch("./contents.json");
	let trackdata = await response.json();
	let categories = {};
	let archives = {};

	// アーカイブ情報の日付によるソート
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

	let tracks = {};

	// 個々ボタンをカテゴリ・アーカイブごとに振り分け
	for (let e of trackdata.tracks) {
		// カテゴリごと
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

		tracks[e.id] = e;
	}

	// お気に入りの読み込み
	let favoritedJson = window.localStorage.getItem("favorited");
	if (favoritedJson == null) {
		app.favoriteds = [];
	} else {
		let favorites = JSON.parse(favoritedJson);
		app.favorites = favorites;

		for (let e of app.favorites) {
			tracks[e].isFavorited = true;
		}
	}

	app.tracks = tracks;
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
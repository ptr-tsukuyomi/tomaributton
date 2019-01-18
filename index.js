let soundRoot = "";

Vue.component("youtube-player", {
	props: ["track"],
	data: function () {
		return { player: null, ytpcontainer: null, oldDisplay: null, playingDetected: false };
	},
	methods: {
		play: function (track) {
			let internalVideoId = getVideoIdByURL(track.source);
			if (internalVideoId.substring(0, 2) != "YT") {
				console.error("The content of this track is not from YouTube.", track);
				return;
			}

			let videoId = internalVideoId.substr(3);

			if (this.player) {
				this.show();
				let param = {videoId: videoId, startSeconds: track.embed.begin, endSeconds: track.embed.end};
				this.player.loadVideoById(param);
			} else {
				this.ytpcontainer = document.getElementById("ytpcontainer");
				let ytpdiv = document.createElement("div");
				ytpdiv.id = "ytplayer";
				this.ytpcontainer.appendChild(ytpdiv);

				let _this = this;
				let param = {
					height: '360',
					width: '640',
					videoId: videoId,
					playerVars: {
						start: track.embed.begin,
						end: track.embed.end,
						rel: 0,
						showinfo: 0,
						controls: 0,
						modestbranding: 1,
						autoplay: 0
					},
					events: {
						'onReady': function (event) {
							_this.player.playVideo();
						},
						'onStateChange': function (event) {
							if (event.data == YT.PlayerState.PLAYING) {
								_this.playingDetected = true;
							}

							if (event.data == YT.PlayerState.ENDED && _this.playingDetected) {
								_this.playingDetected = false;
								_this.hide();
							}
						}
					}
				};
				this.player = new YT.Player("ytplayer", param);
			}
		},
		stop: function () {
			if (this.player) {
				this.player.stopVideo();
				this.hide();
			}
		},
		hide: function () {
			if (this.ytpcontainer.style.display == "none") return;

			this.oldDisplay = this.ytpcontainer.style.display;
			this.ytpcontainer.style.display = "none";
		},
		show: function () {
			this.ytpcontainer.style.display = this.oldDisplay;
		}
	},
	template: `<div id="ytpcontainer"></div>`
});

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
			idToTracks: {},
			tracks: [],
			archiveInfo: {},
			favorites: [],
			track: nullTrack,
			volume: 0.5,
			lastModified: null,
			isFavorited: false,
			selectedGrouping: "category",
			filter: "none",
			counter: {},
			fromYouTube: false
		},
		methods: {
			playButtonClicked: function (track) {
				this.track = track;
				let isFavorited = this.track.isFavorited;
				this.isFavorited = isFavorited == undefined ? false : isFavorited;

				// 押した回数のカウント
				if (this.counter[track.id] == undefined) {
					this.counter[track.id] = 1;
				} else {
					++this.counter[track.id];
				}
				console.log("Counter", track.id, this.counter[track.id]);
				window.localStorage.setItem("counter", JSON.stringify(this.counter));
				++track.count;

				if (track.path) {
					this.$refs.ytplayer.stop();
					this.$refs.player.play(track);
					this.fromYouTube = false;
				} else if (track.embed) {
					this.$refs.player.stop();
					this.$refs.ytplayer.play(track);
					this.fromYouTube = true;
				} else {
					console.error("broken track: path or embed is required.", track);
				}
			},
			stopButtonClicked: function () {
				if (this.fromYouTube) {
					this.$refs.ytplayer.stop();
				} else {
					this.$refs.player.stop();
				}
				
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
			},
			volumeChanged: function (newvol) {
				window.localStorage.setItem("volume", newvol);
			}
		},
		computed: {
			orderedTracks: function () {
				let grouped = new Map();

				for (let e of this.tracks) {
					// filtering
					switch (this.filter) {
						case "favorite":
							if (!e.isFavorited) continue;
							break;
						case "none":
							break;
						default:
							console.error("unknown filtering method", filter);
							break;
					}

					// grouping
					let key = null;
					switch (this.selectedGrouping) {
						case "category":
							key = e.tags[0];
							break;
						case "archive":
							key = e.source != null ? getVideoIdByURL(e.source) : "unknown";
							break;
						case "count":
							key = e.count;
							break;
						default:
							console.error("unknown grouping method", selectedGrouping);
							break;
					}
					if (!grouped.has(key)) grouped.set(key, []);
					grouped.get(key).push(e);
				}

				// sort
				let groupArray = null;
				switch (this.selectedGrouping) {
					case "count":
						groupArray = Array.from(grouped);
						groupArray.sort((a, b) => {
							let ax = parseInt(a[0]);
							let bx = parseInt(b[0]);
							return -ax + bx;
						});
						return groupArray;
						break;
					case "archive":
						groupArray = [];
						for (let e of this.archiveOrder) {
							groupArray.push([e, grouped.has(e) ? grouped.get(e) : []]);
						}
						console.log(groupArray);
						break;
					default:
						groupArray = Array.from(grouped);
						break;
				}
				return groupArray;
			}
		}
	});
	window.app = app;

	// データのロード
	let response = await fetch("./contents.json");
	let trackdata = await response.json();

	// アーカイブ情報を日付でソート
	let archiveInfoArray = Array.from(new Map(Object.entries(trackdata.archiveInfo)));
	archiveInfoArray.sort((a, b) => {
		if (a[1].date < b[1].date) return 1;
		if (a[1].date > b[1].date) return -1;
		return 0;
	});
	let archiveOrder = [];
	for (let e of archiveInfoArray) {
		archiveOrder.push(e[0]);
	}

	// id to track の object の生成とcountの初期化
	let idToTracks = {}; // Map: id => track
	for (let e of trackdata.tracks) {
		idToTracks[e.id] = e;
		e.count = 0;
	}

	// お気に入りの読み込み
	let favoritedJson = window.localStorage.getItem("favorited");
	if (favoritedJson == null) {
		app.favoriteds = [];
	} else {
		let favorites = JSON.parse(favoritedJson);
		app.favorites = favorites;

		for (let e of app.favorites) {
			idToTracks[e].isFavorited = true;
		}
	}

	// volume の読み込み
	let volume = window.localStorage.getItem("volume");
	if (volume != null) {
		app.volume = parseFloat(volume);
	}

	// 押した回数の読み込み
	let counterJson = window.localStorage.getItem("counter");
	if (counterJson != null) {
		let counter = JSON.parse(counterJson); // button id => num(count)
		app.counter = counter;

		for (let e of Object.keys(app.counter)) {
			idToTracks[e].count = app.counter[e];
		}
	}

	app.idToTracks = idToTracks;
	app.tracks = trackdata.tracks;
	app.archiveInfo = trackdata.archiveInfo;
	app.archiveOrder = archiveOrder;
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
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
			track: nullTrack,
			volume: 0.5
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
	for (let e of trackdata.tracks) {
		let category = e.tags[0];
		if (category == "その他") continue;
		if (categories[category] == undefined) {
			categories[category] = [];
		}
		categories[category].push(e);
	}
	app.categories = categories;
	soundRoot = trackdata.soundRoot;
}
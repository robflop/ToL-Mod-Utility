const { remote, ipcRenderer } = require('electron');

const app = new Vue({
	el: '#app',
	data: {
		isLoaded: false,
		parsedMatchInfo: [],
		selectedPlayer: '',
		selectedMeasure: '',
		reportLink: '',
		measureReason: '',
		assembledCommand: ''
	},
	beforeMount() {
		ipcRenderer.on('measures-open', (event, args) => {
			this.parsedMatchInfo = args[0];
			this.isLoaded = args[1];
		});
	},
	methods: {
		assembleCommand() {
			return '';
		}
	}
});
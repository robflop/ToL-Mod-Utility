const { ipcRenderer } = require('electron');

const app = new Vue({
	el: '#app',
	data: {
		isLoaded: false,
		parsedMatchInfo: [],
		selectedMeasure: '',
		selectedPlayer: '',
		reportLink: '',
		measureReason: '',
		assembledCommand: '.game',
		errorMessage: 'Load a match to prepare measures!'
	},
	beforeMount() {
		ipcRenderer.on(`match-load`, (event, args) => {
			this.errorMessage = '';
			this.parsedMatchInfo = args;
			this.isLoaded = true;
		});
		ipcRenderer.on('match-unload', (event, args) => {
			this.errorMessage = 'Load a match to prepare measures!';
			this.assembledCommand = '.game';
			this.selectedPlayer = this.selectedMeasure = this.reportLink = this.measureReason = '';
			this.parsedMatchInfo = [];
			this.isLoaded = false;
		});
	},
	methods: {
		assembleCommand() {
			const threadRequired = ['warn', 'ban1d', 'ban3d', 'ban7d', 'ban15d', 'ban30d', 'ban1y'].includes(this.selectedMeasure);
			const report = `${threadRequired ? ` ${this.reportLink}` : ''}`;
			// The space before the reportLink template string is important! Do not remove!
			if (threadRequired && !this.reportLink) this.errorMessage = 'A report link must be entered.';

			return this.assembledCommand = `.game${this.selectedMeasure} ${this.selectedPlayer}${report} ${this.measureReason}`;
		}
	}
});
const { remote } = require('electron');

const app = new Vue({
	el: '#app',
	data: {
		isLoaded: false,
		selectedPlayer: '',
		selectedMeasure: '',
		reportLink: '',
		measureReason: ''
	},
	methods: {
		assembleCommand() {
			return '';
		}
	}
});
const app = new Vue({
	el: '#app',
	data: {
		isLoaded: false,
		matchInfoInput: '',
		chatLogsInput: '',
		savedChatLogs: '',
		parsedMatchInfo: '',
		parsedChatLogs: '',
		selectedType: 'All',
		selectedPlayer: 'All',
		selectedDay: 'All',
		selectedNight: 'All',
		involvedFilter: false,
		days: 0,
		nights: 0,
		isFiltered: false
	},
	mounted() {
		//
	},
	methods: {
		loadMatch() {
			// this.parsedMatchInfo = JSON.parse(this.matchInfoInput);
			this.parsedMatchInfo = require('../abc').info; // todo temporary
			// this.parsedChatLogs = JSON.parse(this.chatLogsInput).filter(line => line).map(line => line.trim());
			this.parsedChatLogs = require('../abc.js').logs.filter(line => line).map(line => line.trim()); // todo temporary
			this.savedChatLogs = this.parsedChatLogs;
			this.days = this.savedChatLogs.filter(line => /\(Day\) Day \d+/.test(line)).length;
			this.nights = this.savedChatLogs.filter(line => /\(Day\) Night \d+/.test(line)).length;

			return this.isLoaded = true;
		},

		unloadMatch() {
			this.chatLogsInput = ''; this.matchInfoInput = '';
			this.parsedMatchInfo = ''; this.parsedChatLogs = '';
			this.days = 0; this.nights = 0;
			this.savedChatLogs = '';

			return this.isLoaded = false;
		},

		checkType(log) {
			const types = {
				Announcement: 'announcement'
			};

			// console.log(log);

			// return 'alive';
		},

		filter() {
			if (![this.selectedType, this.selectedPlayer, this.selectedDay, this.selectedNight].every(selection => selection === 'All')) {
				if (this.selectedType !== 'All') {
					if (this.selectedType === 'Whisper') {
						// whispers are special because they don't follow the format of other types
						const whisperRegex = /From [\w\s]+ \[\d+] \([\w\s]+\):/;
						return this.parsedChatLogs = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs'].filter(line => {
							return whisperRegex.test(line) || line.startsWith('(Day)') || line.startsWith('(Win)');
						});
					}

					this.parsedChatLogs = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs'].filter(line => {
						return line.startsWith(`(${this.selectedType}`) || line.startsWith('(Day)') || line.startsWith('(Win)');
						// fyi to future self, the missing closing bracket in the type check is intended
					});
				}

				if (this.selectedPlayer !== 'All') {
					const playerRegex = new RegExp(`${this.selectedPlayer} \\[\\d+\\]`);
					this.parsedChatLogs = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs'].filter(line => {
						return playerRegex.test(line) || line.startsWith('(Day)') || line.startsWith('(Win)');
					});
				}

				if (this.selectedDay !== 'All') {
					const start = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs']
						.indexOf(`(Day) ${this.selectedDay}`);
					let end = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs']
						.indexOf(`(Day) Night ${parseInt(this.selectedDay.replace('Day', ''))}`);

					const iterated = [];

					if (parseInt(this.selectedDay.replace('Day', '')) === this.days) end = this.savedChatLogs.length;
					// for last day since there isn't a night following it to detect

					this.parsedChatLogs = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs'].filter((line, index) => {
						if (iterated.includes(index)) { return false; }
						if (index >= start && index <= end) { iterated.push(index); return true; }
						else { return false; }
						// to avoid logs from other phases that have the same content as the one from this phase
					});
				}

				if (this.selectedNight !== 'All') {
					const start = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs']
						.indexOf(`(Day) ${this.selectedNight}`);
					const end = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs']
						.indexOf(`(Day) Day ${parseInt(this.selectedNight.replace('Night', '')) + 1}`);

					const iterated = [];

					this.parsedChatLogs = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs'].filter((line, index) => {
						if (iterated.includes(index)) { return false; }
						if (index >= start && index <= end) { iterated.push(index); return true; }
						else { return false; }
						// to avoid logs from other phases that have the same content as the one from this phase
					});
				}

				if (this.involvedFilter) {
					const playerRegex = new RegExp(`${this.selectedPlayer} \\[\\d+\\]`);

					this.parsedChatLogs = this[this.isFiltered ? 'parsedChatLogs' : 'savedChatLogs'].filter(line => {
						//
					});
				}

				this.isFiltered = true;
			}
			else {
				this.parsedChatLogs = this.savedChatLogs;
				this.isFiltered = false;
			}
		}
	},
	computed: {
		//
	}
});
const app = new Vue({
	el: '#app',
	data: {
		isLoaded: false,
		matchInfoInput: '',
		chatLogsInput: '',
		savedChatLogs: '',
		parsedMatchInfo: '',
		parsedChatLogs: '',
		view: 'generalConfig',
		selectedType: 'All',
		selectedDay: 'All',
		selectedNight: 'All',
		filteredPlayers: [],
		highlightedPlayers: [],
		searchInput: '',
		searchHits: [],
		currentHit: 1,
		seperatorsToggle: false,
		dayNightConflict: false,
		days: 0,
		nights: 0
	},
	methods: {
		loadMatch() {
			if (!this.matchInfoInput || !this.chatLogsInput) return;

			this.parsedMatchInfo = JSON.parse(this.matchInfoInput.replace(/[“”'`]/g, '"'));
			// match info from forums has weird quotes, thus replacing them cause they error otherwise
			this.parsedChatLogs = this.chatLogsInput.split('[,]').filter(line => line).map(line => line.trim());
			// character sequence is the line seperator in raw report logs
			this.savedChatLogs = this.parsedChatLogs;
			this.days = this.savedChatLogs.filter(line => /\(Day\) Day \d+/.test(line)).length;
			this.nights = this.savedChatLogs.filter(line => /\(Day\) Night \d+/.test(line)).length;

			return this.isLoaded = true;
		},

		unloadMatch() {
			this.chatLogsInput = this.matchInfoInput = this.parsedMatchInfo = this.parsedChatLogs = this.savedChatLogs = '';
			this.days = this.nights = 0;
			this.clearFilter();

			return this.isLoaded = false;
		},

		extraStylingCheck(log) {
			const classes = [];
			const logLine = `logLine${this.parsedChatLogs.indexOf(log)}`;

			if (this.seperatorsToggle) {
				classes.push('seperator');
				if (['announcement', 'privateannouncement'].includes(this.checkType(log))) classes.push('seperator-thick');
				else classes.push('seperator-thin');
			}
			if (this.highlightedPlayers.length && this.highlightedPlayers.some(player => log.includes(player))) classes.push('highlight-player');
			if (this.searchInput && log.includes(this.searchInput.toLowerCase())) {
				if (!this.searchHits.includes(logLine)) this.searchHits.push(logLine); // for anchor navigation
				classes.push('highlight-search');
			}

			return classes;
		},

		checkFaction(playerFaction) {
			const factions = ['unseen', 'cult', 'neutral'];
			// blue dragon manually matched below due to reasons also below

			let faction;

			factions.some(fact => { // eslint-disable-line array-callback-return
				if (playerFaction.replace(/\s+/g, '-').toLowerCase() === fact) return faction = fact;
				// replace spaces with dashes because can't have spaces in css class names
			});

			if (playerFaction === 'BlueDragon') return 'blue-dragon';
			// bd isn't seperated by a space, so matching and replacing that to be compliant with css names would be messy
			else return faction;
		},

		checkType(log) {
			const types = [
				'day', 'alive', 'system', 'mind-link', 'attack', 'crier',
				'dead', 'heal', 'win', 'announcement', 'privateannouncement', 'trollbox'
			]; // no type for whisper because that's regex'd below due to formatting

			let logType;

			types.some(type => { // eslint-disable-line array-callback-return
				if (log.toLowerCase().replace(/\s+/g, '-').startsWith(`(${type}`)) return logType = type;
				// replace spaces with dashes because can't have spaces in css class names
			});

			if (/^From ([\w\s]+) \[\d+\]/.test(log)) return 'whisper';
			else return logType;
		},

		adjustView(forward) {
			if (forward && this.currentHit + 1 <= this.searchHits.length) ++this.currentHit;
			else if (!forward && this.currentHit - 1 >= 1) --this.currentHit;
			else return;

			console.log(`old: ${window.location.href}`);
			if (window.location.href.includes('logLine')) {
				window.location.href = `${window.location.href.replace(/#logLine\d+/, `#logLine${this.searchHits[this.currentHit - 1]}`)}`;
			}
			else {
				window.location.href = `${window.location.href}#logLine${this.searchHits[this.currentHit - 1]}`;
			}
			// substracting 1 from the selection cuz of zero-bas'ing on array indexes, first hit would be the second in the searchHits list otherwise
			console.log(`new: ${window.location.href}`);
		},

		filter() {
			let chatLogs = this.savedChatLogs;
			// base (unmodified) logs

			if (this.selectedDay !== 'All' && this.selectedNight !== 'All') this.dayNightConflict = true;
			else this.dayNightConflict = false;
			// when both day and night are filtered for

			if (this.selectedType !== 'All') {
				if (this.selectedType === 'Whisper') {
					// whispers are special because they don't follow the format of other types
					const whisperRegex = /From [\w\s]+ \[\d+] \([\w\s]+\):/;
					chatLogs = chatLogs.filter(line => {
						return whisperRegex.test(line) || line.startsWith('(Day)') || line.startsWith('(Win)');
					});
				}
				else {
					chatLogs = chatLogs.filter(line => {
						return line.startsWith(`(${this.selectedType}`) || line.startsWith('(Day)') || line.startsWith('(Win)');
						// fyi to future self, the missing closing bracket in the type check is intended
					});
				}
			}

			if (this.filteredPlayers.length) {
				chatLogs = chatLogs.filter(line => {
					return this.filteredPlayers.some(player => line.includes(player) || line.startsWith('(Day)') || line.startsWith('(Win)'));
				});
			}

			if (this.selectedDay !== 'All') {
				const start = chatLogs.indexOf(`(Day) ${this.selectedDay}`);
				let end = chatLogs.indexOf(`(Day) Night ${parseInt(this.selectedDay.replace('Day', ''))}`);
				// last line of the day is the first line of the following night
				const iterated = [];

				if (parseInt(this.selectedDay.replace('Day', '')) === this.days) end = chatLogs.length;
				// for last day since there isn't a night following it to detect

				chatLogs = chatLogs.filter((line, index) => {
					if (iterated.includes(index)) { return false; }
					if (index >= start && index <= end) { iterated.push(index); return true; }
					else { return false; }
					// to avoid logs from other phases that have the same content as the one from this phase
				});
			}

			if (this.selectedNight !== 'All') {
				const start = chatLogs.indexOf(`(Day) ${this.selectedNight}`);
				const end = chatLogs.indexOf(`(Day) Day ${parseInt(this.selectedNight.replace('Night', '')) + 1}`);
				// last line of the night is the first line of the following day
				const iterated = [];

				chatLogs = chatLogs.filter((line, index) => {
					if (iterated.includes(index)) { return false; }
					if (index >= start && index <= end) { iterated.push(index); return true; }
					else { return false; }
					// to avoid logs from other phases that have the same content as the one from this phase
				});
			}

			if (this.dayNightConflict) {
				return this.parsedChatLogs = [
					'[Utility Info] Filtering for a specific Night and specific Day at the same time is not possible.',
					'[Utility Info] Please unselect either the Night filter or the Day filter for the filter to function.',
					'[Utility Info] Thank you very much, and apologies for the inconvenience.'
				];
			} // display error info if both day and night were filtered by, because that doesn't make sense

			return this.parsedChatLogs = chatLogs;
		},

		clearFilter() {
			this.view = 'generalConfig';
			this.seperatorsToggle = false;
			this.filteredPlayers = this.highlightedPlayers = [];
			this.selectedType = this.selectedDay = this.selectedNight = 'All';
			this.searchInput = ''; this.searchHits = [];
		}
	}
});
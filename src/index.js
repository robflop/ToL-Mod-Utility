const app = new Vue({
	el: '#app',
	data: {
		isLoaded: false,
		matchInfoInput: '',
		chatLogsInput: '',
		savedChatLogs: [],
		parsedMatchInfo: [],
		parsedChatLogs: [],
		days: 0,
		nights: 0,
		view: 'generalConfig',
		selectedType: 'All',
		selectedDay: 'All',
		selectedNight: 'All',
		selectedPlayerJournal: '',
		filteredPlayers: [],
		highlightedPlayers: [],
		searchInput: '',
		searchHits: [],
		currentHit: 1,
		jumpToHit: 1,
		unloadWipeToggle: true,
		seperatorsToggle: false,
		regexSearchToggle: false,
		entireWordsSearchToggle: false,
		dayNightConflict: false,
		connectionStatuses: ['Connected', 'Left Alive', 'Left Dead', 'Left Won Early', 'Reconnected']
	},
	methods: {
		loadMatch() {
			if (!this.matchInfoInput || !this.chatLogsInput) return;

			this.parsedMatchInfo = JSON.parse(this.matchInfoInput.replace(/[“”'`]/g, '"'));
			// match info from forums has weird quotes, thus replacing them cause they error otherwise
			this.parsedMatchInfo
				.sort((a, b) => a.piIndex - b.piIndex)
				.map(player => player.leftGameReason === 'Reconnected' ? player.pConInt = 4 : null);
			// sort by piIndex and adjust connection status for reconnection
			this.parsedMatchInfo.map(player => { // eslint-disable-line array-callback-return
				player.lastJournalLeft = player.lastJournalLeft.split('\n').filter(line => line).map(line => line.trim());
				player.lastJournalRight = player.lastJournalRight.split('\n').filter(line => line).map(line => line.trim());
			});
			// parse player logs
			this.parsedChatLogs = this.chatLogsInput.split('[,]').filter(line => line).map(line => line.trim());
			// this character sequence is the line seperator in raw report logs
			this.savedChatLogs = this.parsedChatLogs;
			this.days = this.savedChatLogs.filter(line => /\(Day\) Day \d+/.test(line)).length;
			this.nights = this.savedChatLogs.filter(line => /\(Day\) Night \d+/.test(line)).length;

			return this.isLoaded = true;
		},

		unloadMatch() {
			if (this.unloadWipeToggle) this.chatLogsInput = this.matchInfoInput = '';
			this.selectedPlayerJournal = '';
			this.parsedMatchInfo = this.parsedChatLogs = this.savedChatLogs = [];
			this.days = this.nights = 0;
			this.clearFilter();

			return this.isLoaded = false;
		},

		extraStylingCheck(log) {
			const classes = [];
			const logLine = `log-line-${this.parsedChatLogs.indexOf(log)}`;
			let searchHit = false;

			if (this.seperatorsToggle) {
				classes.push('seperator');
				if (['announcement', 'privateannouncement'].includes(this.checkType(log))) classes.push('seperator-thick');
				else classes.push('seperator-thin');
			}
			if (this.highlightedPlayers.length && this.highlightedPlayers.some(player => log.includes(player))) classes.push('highlight-player');

			if (this.searchInput) {
				if (!this.regexSearchToggle && !this.entireWordsSearchToggle) {
					if (log.toLowerCase().includes(this.searchInput.toLowerCase())) searchHit = true;
				}
				else if (this.regexSearchToggle) {
					if (log.match(this.searchInput)) searchHit = true;
				}
				else if (this.entireWordsSearchToggle) {
					if (this.searchInput.split(' ').every(searchWord => log.split(' ').includes(searchWord))) searchHit = true;
				}

				if (searchHit) {
					if (!this.searchHits.includes(logLine)) this.searchHits.push(logLine); // for anchor navigation
					classes.push('highlight-search');
				}
			}

			return classes;
		},

		checkFaction(playerFaction) {
			const factions = ['unseen', 'cult', 'neutral'];
			// blue dragon manually matched below due to reasons also below

			let faction;

			factions.some(fact => { // eslint-disable-line array-callback-return
				if (playerFaction.replace(/\s+/g, '-').toLowerCase() === fact) return faction = fact;
				// replace spaces with dashes because you can't have spaces in css class names
			});

			if (playerFaction === 'BlueDragon') return faction = 'blue-dragon';
			// bd isn't seperated by a space, so matching and replacing that to be compliant with css names would be messy
			return faction;
		},

		checkConnection(playerConnection) {
			return this.connectionStatuses[playerConnection].replace(/\s+/g, '-').toLowerCase();
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

		adjustView(forward, jumpTo) {
			// parse int because number input turns out as string
			if (forward) {
				if (parseInt(this.currentHit) + 1 > this.searchHits.length) this.currentHit = 1;
				else ++this.currentHit;
			}
			else if (!forward && forward !== null) { // not-null check for jumps
				if (parseInt(this.currentHit) - 1 < 1) this.currentHit = this.searchHits.length;
				else --this.currentHit;
			}
			else if (!jumpTo && !this.searchHits.length) return; // eslint-disable-line curly

			if (jumpTo && jumpTo <= this.searchHits.length) this.currentHit = jumpTo;

			if (window.location.href.includes('log-line')) {
				window.location.href = window.location.href.replace(/#log-line-\d+/, `#${this.searchHits[this.currentHit - 1]}`);
			}
			else window.location.href += `#${this.searchHits[this.currentHit - 1]}`; // eslint-disable-line curly
			// substracting 1 from the selection cuz of zero-basing on array indexes, first hit would be the second in the searchHits list otherwise
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
			this.seperatorsToggle = this.regexSearchToggle = this.entireWordsSearchToggle = false;
			this.filteredPlayers = this.highlightedPlayers = this.searchHits = [];
			this.selectedType = this.selectedDay = this.selectedNight = 'All';
			this.searchInput = '';
			this.currentHit = this.jumpToHit = 1;
		}
	}
});
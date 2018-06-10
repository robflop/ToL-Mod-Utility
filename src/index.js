const { remote } = require('electron');

const app = new Vue({
	el: '#app',
	data: {
		isLoaded: false,
		matchInfoInput: '',
		chatLogsInput: '',
		savedChatLogs: [],
		parsedMatchInfo: [],
		parsedChatLogs: [],
		parsedTableChatLogs: [],
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
		colorStripToggle: false,
		tableDisplayToggle: false,
		regexSearchToggle: false,
		entireWordsSearchToggle: false,
		connectionStatuses: ['Connected', 'Left Alive', 'Left Dead', 'Left Won Early', 'Reconnected']
	},
	methods: {
		loadMatch() {
			if (!this.matchInfoInput || !this.chatLogsInput) return;

			try {
				this.parsedMatchInfo = JSON.parse(this.matchInfoInput.replace(/[“”`]/g, '"'));
				// Match info from forums has weird quotes, thus replacing them cause they error otherwise
			}
			catch (e) {
				return remote.dialog.showErrorBox('An error occurred loading the match info', `${e}\n\nShow this error to robflop.`);
			}

			this.parsedMatchInfo
				.sort((a, b) => a.piIndex - b.piIndex)
				.map(player => player.leftGameReason === 'Reconnected' ? player.pConInt = 4 : null);
			// Sort by piIndex and adjust connection status for reconnection

			// this.parsedMatchInfo = this.parsedMatchInfo.filter(player => player.piIndex !== -1);
			// ABOVE DISABLED BECAUSE BROKEN; filter out players that didn't load into the game (piIndex === -1)
			this.parsedMatchInfo.map(player => { // eslint-disable-line array-callback-return
				player.lastJournalLeft = player.lastJournalLeft.split('\n').filter(line => line !== '').map(line => line.trim());
				player.lastJournalRight = player.lastJournalRight.split('\n').filter(line => line !== '').map(line => line.trim());
			});
			this.parsedChatLogs = this.chatLogsInput.split('[,]').filter(line => line !== '')

			// Character sequence in above split is line seperator, filter used to remove empty lines
				.map(line => {
					line = line.trim();

					const colorTagStartRegex = /\[color=#[a-fA-F0-9]{6}\]\s?/;
					const colorTagEndRegex = /\s?\[\/color]/;
					const formattingTagRegex = /<\/?[bius]>/gm;

					if (colorTagStartRegex.test(line)) line.match(colorTagStartRegex).forEach(match => line = line.replace(match, ''));
					if (colorTagEndRegex.test(line)) line.match(colorTagEndRegex).forEach(match => line = line.replace(match, ''));
					// Check log lines for color tags like "[color=#fffff]" and "[/color]", then remove them if found
					if (formattingTagRegex.test(line)) line.match(formattingTagRegex).forEach(match => line = line.replace(match, ''));
					// Check lines for formatting tags like "<i>..</i>" etc and remove them
					return line;
				});

			this.parsedTableChatLogs = this.parsedChatLogs.map(line => {
				const lineParts = line.startsWith('From') // Only Whispers start like this and have multiple colons
					? this.splitLine(line)
					: line.split(':').map(linePart => linePart = linePart.trim());

				if (lineParts[0] && lineParts[1]) lineParts[0] = `${lineParts[0]}:`;

				return line = { meta: lineParts[0], content: lineParts[1] || '', origin: line };
				// Split lines in meta info (type, participant, etc), content (actual message) and unmodified line
			});

			this.savedChatLogs = this.parsedChatLogs;
			// Logs backup to refer to in filtering etc

			if (this.tableDisplayToggle) this.parsedChatLogs = this.parsedTableChatLogs;

			this.days = this.savedChatLogs.filter(line => /^\(Day\) Day \d+/.test(line)).length;
			this.nights = this.savedChatLogs.filter(line => /^\(Day\) Night \d+/.test(line)).length;

			return this.isLoaded = true;
		},

		unloadMatch() {
			if (this.unloadWipeToggle) this.chatLogsInput = this.matchInfoInput = '';
			this.selectedPlayerJournal = '';
			this.parsedMatchInfo = this.parsedChatLogs = this.parsedTableChatLogs = this.savedChatLogs = [];
			this.days = this.nights = 0;
			this.view = 'generalConfig';
			this.clearFilter();

			return this.isLoaded = false;
		},

		extraStylingCheck(log) {
			const classes = [];
			const logLine = `log-line-${this.savedChatLogs.indexOf(log)}`;
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
					if (!this.searchHits.includes(logLine)) this.searchHits.push(logLine); // For anchor navigation
					classes.push('highlight-search');
				}
			}

			return classes;
		},

		checkFaction(playerFaction) {
			const factions = ['unseen', 'cult', 'neutral'];
			// Blue dragon manually matched below due to reasons also below

			let faction;

			factions.some(fact => {
				if (playerFaction.replace(/\s+/g, '-').toLowerCase() === fact) return faction = fact;
				// Replace spaces with dashes because you can't have spaces in css class names
				else return null;
			});

			if (playerFaction === 'BlueDragon') return faction = 'blue-dragon';
			// BD isn't seperated by a space, so matching and replacing that to be compliant with css names would be messy
			return faction;
		},

		checkConnection(playerConnection) {
			return this.connectionStatuses[playerConnection].replace(/\s+/g, '-').toLowerCase();
		},

		checkType(log) {
			if (this.colorStripToggle) return;

			const types = [
				'day', 'alive', 'system', 'mind-link', 'attack', 'dead',
				'heal', 'win', 'announcement', 'privateannouncement', 'trollbox'
			]; // No type for whisper because that's regex'd below due to formatting

			let logType;

			types.some(type => {
				if (log.toLowerCase().replace(/\s+/g, '-').startsWith(`(${type}`)) return logType = type;
				// Replace spaces with dashes because can't have spaces in css class names
				else return null;
			});

			if (/^From ([\w\s]+) \[\d+\]/.test(log)) return 'whisper';
			else return logType;
		},

		adjustView(forward, jumpTo) {
			// Parse int because number input turns out as string
			if (forward) {
				if (parseInt(this.currentHit) + 1 > this.searchHits.length) this.currentHit = 1;
				else ++this.currentHit;
			}
			else if (!forward && forward !== null) { // Not-null check for jumps
				if (parseInt(this.currentHit) - 1 < 1) this.currentHit = this.searchHits.length;
				else --this.currentHit;
			}
			else if (!jumpTo && !this.searchHits.length) return; // eslint-disable-line curly

			if (jumpTo && jumpTo <= this.searchHits.length) this.currentHit = jumpTo;

			if (window.location.href.includes('log-line')) {
				window.location.href = window.location.href.replace(/#log-line-\d+/, `#${this.searchHits[this.currentHit - 1]}`);
			}
			else {
				window.location.href += `#${this.searchHits[this.currentHit - 1]}`;
			} // Substracting 1 from the selection cuz of zero-basing on array indices, first hit would be the second in the searchHits list otherwise
		},

		filter() {
			let chatLogs = this.savedChatLogs;
			// Base (unmodified) logs
			let matchedLogIndices = Array.from(this.savedChatLogs.keys());
			// Make an array with all chatlog entry indices to later sort out
			const sortingIndices = {};

			if (this.selectedDay !== 'All' && this.selectedNight !== 'All') {
				if (!this.tableDisplayToggle) {
					return this.parsedChatLogs = [
						'[Utility Info] Filtering for a specific Night and specific Day at the same time is not possible.',
						'[Utility Info] Please unselect either the Night filter or the Day filter for the filter to function.',
						'[Utility Info] Thank you very much, and apologies for the inconvenience.'
					];
				}
				else {
					return this.parsedChatLogs = [
						{ origin: '', meta: '[Utility Info] Filtering for a specific Night and specific Day at the same time is not possible.' },
						{ origin: '', meta: '[Utility Info] Please unselect either the Night filter or the Day filter for the filter to function.' },
						{ origin: '', meta: '[Utility Info] Thank you very much, and apologies for the inconvenience.' }
					];
				}
			} // Display error info if both day and night were filtered by, because that doesn't make sense

			if (this.selectedType !== 'All') {
				if (this.selectedType === 'Whisper') {
					// Whispers are special because they don't follow the format of other types
					const whisperRegex = /From [\w\s]+ \[\d+] \([\w\s]+\):/;

					chatLogs = chatLogs.filter(line => {
						return whisperRegex.test(line) || line.startsWith('(Day)') || line.startsWith('(Win)');
					});
				}
				else {
					chatLogs = chatLogs.filter(line => {
						return line.startsWith(`(${this.selectedType}`) || line.startsWith('(Day)') || line.startsWith('(Win)');
						// Fyi to future self, the missing closing bracket in the type check is intended
					});
				}

				sortingIndices.typeIndices = chatLogs.map(line => line = this.savedChatLogs.indexOf(line));
			}

			if (this.filteredPlayers.length) {
				chatLogs = chatLogs.filter(line => {
					let hit = false;

					if (this.filteredPlayers.some(player => line.includes(player))) hit = true;
					if (line.startsWith('(Day)') || line.startsWith('(Win)')) hit = true;

					return hit;
				});

				sortingIndices.playerIndices = chatLogs.map(line => line = this.savedChatLogs.indexOf(line));
			}

			if (this.selectedDay !== 'All') {
				const start = chatLogs.indexOf(`(Day) ${this.selectedDay}`);
				let end = chatLogs.indexOf(`(Day) Night ${parseInt(this.selectedDay.replace('Day', ''))}`);
				// Last line of the day is the first line of the following night

				if (parseInt(this.selectedDay.replace('Day', '')) === this.days) end = chatLogs.length;
				// For last day since there isn't a night following it to detect

				sortingIndices.dayIndices = Array.from({ length: end - (start - 1) }, (v, i) => i + start);
				// Fill the indices array with all indices from start to end, minus one to include last number (end)
			}

			if (this.selectedNight !== 'All') {
				const start = chatLogs.indexOf(`(Day) ${this.selectedNight}`);
				const end = chatLogs.indexOf(`(Day) Day ${parseInt(this.selectedNight.replace('Night', '')) + 1}`);
				// Last line of the night is the first line of the following day

				chatLogs = chatLogs.filter((line, index) => {
					if (index >= start && index <= end) return true;
					else return false;
				});

				sortingIndices.nightIndices = Array.from({ length: end - (start - 1) }, (v, i) => i + start);
			}

			matchedLogIndices = matchedLogIndices.filter(index => {
				return Object.values(sortingIndices).every(sortingOption => {
					return sortingOption.includes(index);
				});
			}); // Filter to only include indices included in every chosen sorting option's results

			matchedLogIndices = matchedLogIndices.sort((a, b) => a - b);

			const knownIndices = {};
			const appropriateLogs = this.tableDisplayToggle ? this.parsedTableChatLogs : this.savedChatLogs;

			return this.parsedChatLogs = appropriateLogs.filter(line => {
				let lineIndex = appropriateLogs.indexOf(line);
				let inIndiceRange = matchedLogIndices.includes(lineIndex);

				if (knownIndices.hasOwnProperty(line)) {
					lineIndex = appropriateLogs.indexOf(line, knownIndices[line] + 1);
					// Grab the same line but with the offset from finding it the previous time
					inIndiceRange = matchedLogIndices.includes(lineIndex);
					// Re-evaluate if new index is to be included if found
				}

				if (inIndiceRange || knownIndices.hasOwnProperty(line)) knownIndices[line] = lineIndex;

				const outOfBounds = (inIndiceRange && lineIndex < matchedLogIndices[0])
				|| (inIndiceRange && lineIndex > matchedLogIndices[matchedLogIndices.length - 1]);
				// Same message, different index (e.g. player writing the same thing on different days)

				if (!inIndiceRange) {
					return false;
				}
				else if (outOfBounds) {
					return false;
				}
				else {
					return true;
				}
			});
		},

		clearFilter() {
			this.filteredPlayers = this.highlightedPlayers = this.searchHits = [];
			this.selectedType = this.selectedDay = this.selectedNight = 'All';
			this.searchInput = '';
			this.currentHit = this.jumpToHit = 1;
		},

		splitLine(line) {
			let currentIndex = 0;

			for (let i = 0; i < 3; i++) {
				currentIndex = line.indexOf(':', currentIndex);
				currentIndex++; // Increment so it's one past the latest match
			}

			return [line.substring(0, currentIndex - 3), line.substring(currentIndex)];
			// Minus 3 because the last 3 character are unnecessary whitespace and colons
		}
	}
});
const { remote } = require('electron');
const { productName, version, description } = require('../../package.json');

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
		regexFlags: [],
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
				return remote.dialog.showErrorBox('An error occurred loading the match info',
					`${e}
					

					Make sure you typed everything in / copied it in from the forums without mistakes.
					If the error persists after doing so, notify robflop of the error and the report it happened in.`
				);
			}

			this.parsedMatchInfo
				.sort((a, b) => a.piIndex - b.piIndex)
				.map(player => player.leftGameReason === 'Reconnected' ? player.pConInt = 4 : null);
			// Sort by piIndex and adjust connection status for reconnection -- Ternary used to one-line it

			this.parsedMatchInfo.forEach(player => {
				player.lastJournalLeft = player.lastJournalLeft.split('\n').filter(line => line !== '').map(line => line.trim());
				player.lastJournalRight = player.lastJournalRight.split('\n').filter(line => line !== '').map(line => line.trim());
			});

			this.parsedChatLogs = this.chatLogsInput.replace(/(\[,\]\s)(\[,\]\s)/g, '$1').split('[,]')
			// Character sequence in above split is line seperator, filter used to remove empty lines
			// Replace is used to kill the extra empty lines included in the chat logs from forums
				.map(line => {
					const colorTagRegex = /\[\/?color(?:=#[a-fA-F0-9]{6})?\]/gm;
					const formattingTagRegex = /<\/?[bius]>/gm;

					if (colorTagRegex.test(line)) line.match(colorTagRegex).forEach(match => line = line.replace(match, ''));
					// Check log lines for color tags like "[color=#fffff]" and "[/color]", then remove them if found
					if (formattingTagRegex.test(line)) line.match(formattingTagRegex).forEach(match => line = line.replace(match, ''));
					// Check lines for formatting tags like "<i>..</i>" etc and remove them
					return line.trim();
				});

			const loadingUnclear = this.parsedMatchInfo.filter(player => player.piIndex === -1);
			// piIndex -1 stands for "player didn't load into the game", but is unclear because sometimes they still do

			loadingUnclear.forEach(player => {
				const playerEntry = this.parsedMatchInfo.find(p => p.pid === player.pid);
				const easyDName = player.dName.replace(/["!{}=,\[\]\?\(\)]*/g, '').trim();
				// Take special characters out of the player's account name for ease of use
				const extraChars = player.dName === easyDName ? '' : '.+';
				// If dName had special characters, match more characters after their easified one, and if not don't match more
				// eslint-disable-next-line max-len
				const playerInfoRegex = new RegExp(`(?:\\([\\w+\\s]*?to)?\\s([\\w+\\s]+)\\s\\[(\\d+)\\]\\s\\((${easyDName}${extraChars})\\s-\\s([\\w\\s]+)\\)\\)?`);
				const playerLine = this.parsedChatLogs.find(line => playerInfoRegex.test(line));
				if (playerLine) {
					if (playerLine.startsWith('From')) {
						// Whispers are too annoying to analyze
						return playerEntry.loadError = false;
					}
					else {
						const playerInfo = playerLine.match(playerInfoRegex);

						if (playerInfo) {
							playerEntry.ign = playerInfo[1];
							playerEntry.piIndex = playerInfo[2] - 1;
							// Minus one because of zero-indexing
							playerEntry.dName = playerInfo[3];
							// For when a player has question marks in their dName, easier than replacing it across all log lines
							playerEntry.startClass = playerInfo[4];
						} // Fill out some of the basic info missing in the supplied match info

						return playerEntry.loadError = false;
					}
				}
				else {
					return playerEntry.loadError = true;
				}
			}); // If anything ingame ever is about/with them, we can assume they did load in, if not they didn't load

			this.parsedMatchInfo = this.parsedMatchInfo.filter(player => !player.loadError);
			// Works for players that weren't suspected of not loading and for ones that were falsely suspected

			this.parsedTableChatLogs = this.parsedChatLogs.map(line => {
				const lineParts = line.startsWith('From') // Only Whispers start like this and have multiple colons
					? this.splitWhisper(line)
					: line.split(':').map(linePart => linePart = linePart.trim());

				if (lineParts[0] && lineParts[1]) lineParts[0] = `${lineParts[0]}:`;
				// Restore the colon in front of the first part that was cut off when splitting

				return line = { meta: lineParts[0], content: lineParts[1] || '', original: line };
				// Split lines in meta info (type, participant, etc), content (actual message) and unmodified line
			});

			this.savedChatLogs = this.parsedChatLogs;
			// Logs backup to refer to in filtering etc

			if (this.tableDisplayToggle) this.parsedChatLogs = this.parsedTableChatLogs;

			this.days = this.savedChatLogs.filter(line => /^\(Day\) Day \d+/.test(line)).length;
			this.nights = this.savedChatLogs.filter(line => /^\(Day\) Night \d+/.test(line)).length;

			const measuresWindow = remote.BrowserWindow.getAllWindows()[1];
			if (measuresWindow) measuresWindow.webContents.send('match-load', this.parsedMatchInfo);
			// Send required data to measures window on load if it's opened

			return this.isLoaded = true;
		},

		unloadMatch() {
			if (this.unloadWipeToggle) this.chatLogsInput = this.matchInfoInput = '';
			this.selectedPlayerJournal = '';
			this.parsedMatchInfo = this.parsedChatLogs = this.parsedTableChatLogs = this.savedChatLogs = [];
			this.days = this.nights = 0;
			this.view = 'generalConfig';
			this.clearFilter();

			const measuresWindow = remote.BrowserWindow.getAllWindows()[1];
			if (measuresWindow) measuresWindow.webContents.send('match-unload', null);
			// Send instructions to measures window to empty data if it's opened

			return this.isLoaded = false;
		},

		extraStylingCheck(log) {
			const classes = [];
			const logLine = `log-line-${this.savedChatLogs.indexOf(log)}`;
			let searchHit = false;

			if (this.seperatorsToggle) {
				classes.push('seperator');
				classes.push('seperator-thin');
				// Seperate classes in case a 2nd seperator type is requested (thicker, thinner, etc)
			}
			if (this.highlightedPlayers.length && this.highlightedPlayers.some(player => log.includes(player))) classes.push('highlight-player');

			if (this.searchInput) {
				if (!this.regexSearchToggle && !this.entireWordsSearchToggle) {
					if (log.toLowerCase().includes(this.searchInput.toLowerCase())) searchHit = true;
				}
				else if (this.regexSearchToggle) {
					let searchRegex;

					try {
						searchRegex = new RegExp(this.searchInput, this.regexFlags.join(''));
					}
					catch (e) {
						null;
					} // try-catch so the below test method doesn't error due to invalid regex

					if (searchRegex && searchRegex.test(log)) searchHit = true;
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
			const factions = ['unseen', 'cult', 'neutral', 'bluedragon'];

			let faction;

			factions.some(fact => {
				if (playerFaction.replace(/\s+/g, '-').toLowerCase() === fact) return faction = fact;
				// Replace spaces with dashes because you can't have spaces in css class names
				else return null;
			});

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
				// Jumping to first match if next number would go out of range
				else ++this.currentHit;
			}
			else if (!forward && forward !== null) { // Not-null check for jumps
				if (parseInt(this.currentHit) - 1 < 1) this.currentHit = this.searchHits.length;
				// Jump to last match if previous number would go negative
				else --this.currentHit;
			}

			if (jumpTo && jumpTo > this.searchHits.length) {
				this.jumpToHit = this.currentHit = this.searchHits.length;
				// If trying to jump out of range set to last hit
			}
			if (jumpTo && jumpTo < 1) {
				this.jumpToHit = this.currentHit = 1;
				// Prevent jumps to negative numbers
			}
			if (jumpTo && jumpTo <= this.searchHits.length) {
				this.currentHit = jumpTo;
			}

			if (window.location.href.includes('log-line')) {
				if (window.location.href.includes('log-line--1')) {
					return window.location.href = window.location.href.replace('#log-line--1', `#${this.searchHits[this.currentHit - 1]}`);
				}
				return window.location.href = window.location.href.replace(/#log-line-\d+/, `#${this.searchHits[this.currentHit - 1]}`);
			}
			else {
				if (this.currentHit - 1 < 0) return window.location.href += `#${this.searchHits[0]}`;
				else return window.location.href += `#${this.searchHits[this.currentHit - 1]}`;
			} // Substracting 1 from the selection cuz of zero-basing on array indices, first hit would be the second in the searchHits list otherwise
		},

		filter() {
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
						{ original: '', meta: '[Utility Info] Filtering for a specific Night and specific Day at the same time is not possible.' },
						{ original: '', meta: '[Utility Info] Please unselect either the Night- or the Day filter to restore filter functionality.' },
						{ original: '', meta: '[Utility Info] Thank you very much, and apologies for the inconvenience.' }
					];
				}
			} // Display error info if both day and night were filtered by, because that doesn't make sense

			if (this.selectedType !== 'All') {
				const typeHits = [];

				if (this.selectedType === 'Whisper') {
					// Whispers are special because they don't follow the format of other types
					const whisperRegex = /From [\w\s]+ \[\d+] \([\w\s]+\):/;

					this.savedChatLogs.forEach((line, index) => {
						if (whisperRegex.test(line) || line.startsWith('(Day)') || line.startsWith('(Win)')) {
							return typeHits.push(index);
						}
						else {
							return null;
						}
					});
				}
				else {
					this.savedChatLogs.forEach((line, index) => {
						if (line.startsWith(`(${this.selectedType}`) || line.startsWith('(Day)') || line.startsWith('(Win)')) {
							return typeHits.push(index);
						} // Fyi to future self, the missing closing bracket in the type check is intended
						else {
							return null;
						}
					});
				}

				sortingIndices.typeIndices = typeHits;
			}

			if (this.filteredPlayers.length) {
				const playerHits = [];

				this.savedChatLogs.forEach((line, index) => {
					if (this.filteredPlayers.some(player => line.includes(player)) || line.startsWith('(Day)') || line.startsWith('(Win)')) {
						return playerHits.push(index);
					}
					else {
						return null;
					}
				});

				sortingIndices.playerIndices = playerHits;
			}

			if (this.selectedDay !== 'All') {
				const start = this.savedChatLogs.indexOf(`(Day) ${this.selectedDay}`);
				let end = this.savedChatLogs.indexOf(`(Day) Night ${parseInt(this.selectedDay.replace('Day', ''))}`);
				// Last line of the day is the first line of the following night

				if (parseInt(this.selectedDay.replace('Day', '')) === this.days) end = this.savedChatLogs.length;
				// For last day since there isn't a night following it to detect

				sortingIndices.dayIndices = Array.from({ length: end - (start - 1) }, (v, i) => i + start);
				// Fill the indices array with all indices from start to end, minus one to include last number (end)
			}

			if (this.selectedNight !== 'All') {
				const start = this.savedChatLogs.indexOf(`(Day) ${this.selectedNight}`);
				const end = this.savedChatLogs.indexOf(`(Day) Day ${parseInt(this.selectedNight.replace('Night', '')) + 1}`);
				// Last line of the night is the first line of the following day

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

				if (!inIndiceRange || outOfBounds) return false;
				else return true;
			});
		},

		clearFilter() {
			this.filteredPlayers = this.highlightedPlayers = this.searchHits = [];
			this.selectedType = this.selectedDay = this.selectedNight = 'All';
			this.searchInput = '';
			this.currentHit = this.jumpToHit = 1;
		},

		splitWhisper(line) {
			let currentIndex = 0;

			for (let i = 0; i < 3; i++) { // 3 because whispers have 3 colons in total
				currentIndex = line.indexOf(':', currentIndex) + 1;
				// Increment by one so it's one past the latest match
			}

			return [line.substring(0, currentIndex - 3), line.substring(currentIndex)];
			// Minus 3 because the last 3 character are unnecessary whitespace and colons
		},

		openMeasurePrep() {
			if (remote.BrowserWindow.getAllWindows().length >= 2) return;
			// Don't open more than one measure prep window

			const measuresWindow = new remote.BrowserWindow({
				width: 940,
				height: 240,
				resizable: false,
				webPreferences: { devTools: false },
				center: true,
				show: false
			});

			measuresWindow.loadURL(`file://${__dirname}/../html/measures.html`);
			measuresWindow.on('ready-to-show', () => {
				measuresWindow.webContents.send('match-load', this.parsedMatchInfo);
				// Send match data to the measures window when it opens
				measuresWindow.setMenu(null);
				measuresWindow.setSize(940, 240);
				measuresWindow.setTitle(`${productName} ${version} - ${description} [Measure Preparation]`);
				measuresWindow.show();
			});
		}
	}
});
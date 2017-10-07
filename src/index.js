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
		days: 0,
		nights: 0
	},
	methods: {
		loadMatch() {
			if (!this.matchInfoInput || !this.chatLogsInput) return;

			this.parsedMatchInfo = JSON.parse(this.matchInfoInput.replace(/[“”'`]/g, '"'));
			// match info from forums has weird quotes, thus replacing them cause they error otherwise
			this.parsedChatLogs = this.chatLogsInput.split('¬').filter(line => line).map(line => line.trim());
			// this "not sign" character is the line seperator in raw report logs
			this.savedChatLogs = this.parsedChatLogs;
			this.days = this.savedChatLogs.filter(line => /\(Day\) Day \d+/.test(line)).length;
			this.nights = this.savedChatLogs.filter(line => /\(Day\) Night \d+/.test(line)).length;

			return this.isLoaded = true;
		},

		unloadMatch() {
			this.chatLogsInput = this.matchInfoInput = this.parsedMatchInfo = this.parsedChatLogs = this.savedChatLogs = '';
			this.selectedType = this.selectedPlayer = this.selectedDay = this.selectedNight = 'All';
			this.days = this.nights = 0;

			return this.isLoaded = false;
		},

		checkType(log) {
			const types = [
				'day', 'alive', 'system', 'mind link', 'attack', 'crier',
				'dead', 'heal', 'win', 'announcement', 'privateannouncement'
			]; // no type for whisper because that's regex'd below due to formatting

			let logType;

			types.some((type, i, types) => { // eslint-disable-line array-callback-return
				if (log.toLowerCase().startsWith(`(${type}`)) return logType = type;
			});

			if (/^From ([\w\s]+) \[\d+\]/.test(log)) return 'whisper';
			else return logType;
		},

		filter() {
			let chatLogs = this.savedChatLogs;
			// base (unmodified) logs

			if (this.selectedType !== 'All') {
				if (this.selectedType === 'Whisper') {
					// whispers are special because they don't follow the format of other types
					const whisperRegex = /From [\w\s]+ \[\d+] \([\w\s]+\):/;
					return chatLogs = chatLogs.filter(line => {
						return whisperRegex.test(line) || line.startsWith('(Day)') || line.startsWith('(Win)');
					});
				}

				chatLogs = chatLogs.filter(line => {
					return line.startsWith(`(${this.selectedType}`) || line.startsWith('(Day)') || line.startsWith('(Win)');
					// fyi to future self, the missing closing bracket in the type check is intended
				});
			}

			if (this.selectedPlayer !== 'All') {
				const playerRegex = new RegExp(`${this.selectedPlayer} \\[\\d+\\]`);
				chatLogs = chatLogs.filter(line => {
					return playerRegex.test(line) || line.startsWith('(Day)') || line.startsWith('(Win)');
				});
			}

			if (this.selectedDay !== 'All') {
				const start = chatLogs.indexOf(`(Day) ${this.selectedDay}`);
				let end = chatLogs.indexOf(`(Day) Night ${parseInt(this.selectedDay.replace('Day', ''))}`);

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

				const iterated = [];

				chatLogs = chatLogs.filter((line, index) => {
					if (iterated.includes(index)) { return false; }
					if (index >= start && index <= end) { iterated.push(index); return true; }
					else { return false; }
					// to avoid logs from other phases that have the same content as the one from this phase
				});
			}

			this.parsedChatLogs = chatLogs;
		}
	}
});
const fs = require('fs');
const path = require('path');

const readConfig = pathToConfig => {
	return JSON.parse(
		fs
			.readFileSync(path.join(__dirname, pathToConfig))
			.toString()
			.replace(/\/\*[.\s]*?\*\//gi, ''),
	);
};

module.exports = {
	readConfig,
};

const fs = require('fs');
const path = require('path');

const readConfig = pathToConfig => {
	const resolvedPath = path.join(__dirname, pathToConfig);

	return JSON.parse(
		fs
			.readFileSync(resolvedPath)
			.toString()
			.replace(/\/\*[.\s\S]*?\*\//gi, ''),
	);
};

module.exports = {
	readConfig,
};

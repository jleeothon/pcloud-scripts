'use strict';

function * getFoldersRecursive(folder) {
	yield folder;
	for (const subFolder of folder.contents.filter(f => f.isfolder)) {
		yield * getFoldersRecursive(subFolder);
	}
}

function * getFilesRecursive(folder, filter = null) {
	for (const file of folder.contents.filter(f => !f.isfolder)) {
		if (!filter || filter(file)) {
			yield file;
		}
	}

	for (const subFolder of folder.contents.filter(f => f.isfolder)) {
		yield * getFilesRecursive(subFolder);
	}
}

module.exports = {getFoldersRecursive, getFilesRecursive};

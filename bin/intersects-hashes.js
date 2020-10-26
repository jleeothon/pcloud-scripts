'use strict';

const pcloudSdk = require('pcloud-sdk-js');
const pMap = require('p-map');

const client = pcloudSdk.createClient(process.env.ACCESS_TOKEN);

function intersects(a, b) {
	for (const v of a.values()) {
		if (b.has(v)) {
			return true;
		}
	}

	return false;
}

function mergeNames(hashesPerName) {
	const result = [];
	for (const {name, hashes} of hashesPerName) {
		const resultItem = result.find(i => intersects(hashes, i.hashUnion));
		if (!resultItem) {
			result.push({names: [name], hashUnion: hashes});
			continue;
		}

		resultItem.names.push(name);
		hashes.forEach(h => resultItem.hashUnion.add(h));
	}

	return result;
}

async function run() {
	const folderId = Number.parseInt(process.env.FOLDER_ID, 10);
	const allFiles = await client.listfolder(folderId, {recursive: true});
	const goodFolders = allFiles.contents.filter(f =>
		f.name.match(/^[\w-]+ \d+$/)
	);

	const hashesPerName = await pMap(goodFolders, async f => {
		const name = f.name;
		const hashList = f.contents
			.filter(f => f.category === 1)
			.map(f => f.hash);
		const hashes = new Set(hashList);
		return {name, hashes};
	});

	// [{names: [], hashUnion: Set}, ...]
	const nonSingleMergedNames = mergeNames(hashesPerName);
	const mergedNames = nonSingleMergedNames.filter(
		({names}) => names.length > 1
	);

	// [[name1, name2, name3], ...]
	const onlyNames = mergedNames.map(({names}) => names);

	console.log(onlyNames);
}

run().catch(error => {
	console.error(error);
});

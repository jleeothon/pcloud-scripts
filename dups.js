// Finds duplicates within a folder

const pcloudSdk = require('pcloud-sdk-js');
const pMap = require('p-map');

const client = pcloudSdk.createClient(process.env.ACCESS_TOKEN);

function groupByHash(files) {
	const hashToFilesMap = new Map();
	for (const file of files) {
		const fileGroup = hashToFilesMap.get(file.hash);
		if (fileGroup) {
			fileGroup.push(file);
		} else {
			hashToFilesMap.set(file.hash, [file]);
		}
	}

	// Map<hash, file[]>
	return hashToFilesMap;
}

function minDate(file) {
	const created = new Date(file.created).getTime();
	const modified = new Date(file.modified).getTime();
	return created < modified ? created : modified;
}

async function run() {
	const folderId = Number.parseInt(process.env.FOLDER_ID, 10);
	const allFiles = await client.listfolder(folderId, {recursive: true});
	const goodFolders = allFiles.contents.filter((f) =>
		f.name.match(/^[\w-]+ \d+$/)
	);

	const dupFilesPerFolderUnfiltered = await pMap(
		goodFolders,
		async (folder) => {
			const name = folder.name;
			const imageFiles = folder.contents.filter((file) => file.category === 1);
			const hashToFilesMap = groupByHash(imageFiles);
			const fileGroups = [...hashToFilesMap.values()].filter(
				(files) => files.length > 1
			);
			fileGroups.sort((a, b) => {
				return minDate(a) - minDate(b);
			});
			return {name, fileGroups};
		}
	);

	const dupFilesPerFolder = dupFilesPerFolderUnfiltered.filter(
		({fileGroups}) => fileGroups.length
	);

	const deletion = dupFilesPerFolder.map(({name, fileGroups}) => {
		const keepDelGroups = fileGroups.map((g) => ({
			keep: g[0],
			del: g.slice(1)
		}));
		return {name, keepDelGroups};
	});

	console.log(JSON.stringify(deletion, null, 4));

	const allToDelete = deletion
		.flatMap(({keepDelGroups}) => keepDelGroups.map(({del}) => del))
		.flat();
	await pMap(
		allToDelete,
		async (file) => {
			console.log(`Deleting ${file.name}`);
			await client.deletefile(file.fileid);
		},
		{concurrency: 10}
	);
}

run().catch((error) => {
	console.error(error);
});

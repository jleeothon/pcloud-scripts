'use strict';

const pcloudSdk = require('pcloud-sdk-js');
const pMap = require('p-map');
const delay = require('delay');
const {join} = require('path');

const pClient = pcloudSdk.createClient(process.env.ACCESS_TOKEN);

const {program} = require('commander');

async function run(folderPaths) {
	const folders = await pMap(folderPaths, async path => {
		const {metadata} = await pClient.api('listfolder', {params: {path}});
		return metadata;
	});

	const fileNamesToFiles = new Map();
	for (const folder of folders) {
		for (const file of folder.contents) {
			const fileName = file.name;
			const entry = fileNamesToFiles.get(fileName) || [];
			entry.push(file);
			fileNamesToFiles.set(fileName, entry);
		}
	}

	// Order by oldest to newest
	for (const files of fileNamesToFiles.values()) {
		files.sort((a, b) => a.created - b.created);
	}

	const [destinationFolder, ...otherFolders] = folders;

	await pMap(fileNamesToFiles.values(), async files => {
		const file = files[0];
		if (file.parentfolderid === destinationFolder.folderid) {
			return;
		}

		console.log(`Moving "${file.path}" to "${destinationFolder.path}"`);
		await pClient.movefile(Number.parseInt(file.fileid), destinationFolder.folderid);
	}, {concurrency: 1});

	await pMap(otherFolders, async folder => {
		console.log(`Deleting ${folder.path}`);
		await pClient.deletefolder(folder.folderid);
	});
}

// First folder is destination

program
	.option('-p, --prefix <prefix>')
	.arguments('<folders...>')
	.action((folders, {prefix}) => {
		if (prefix) {
			folders = folders.map(f => join(prefix, f));
		}

		run(folders).catch(error => console.error(error));
	});

program.parse(process.argv);

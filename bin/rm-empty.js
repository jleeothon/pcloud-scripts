// Remove empty folders

const pcloudSdk = require('pcloud-sdk-js');
const pMap = require('p-map');
const pFilter = require('p-filter');
const delay = require('delay');

const client = pcloudSdk.createClient(process.env.ACCESS_TOKEN);

async function run() {
	const folderId = Number.parseInt(process.env.FOLDER_ID, 10);
	const allFiles = await client.listfolder(folderId, {recursive: true});
	const foldersToRemove = await pFilter(allFiles.contents, f => {
		return f.isfolder && f.contents.length === 0;
	});
	console.log(foldersToRemove);
	await pMap(foldersToRemove, async f => {
		const delayPromise = delay(2000);
		await client.deletefolder(f.folderid);
		await delayPromise;
	}, {concurrency: 10});
}

run().catch(error => console.error('Error', error));

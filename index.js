const Botkit = require('botkit');
const request = require('request');
const parseXML = require('xml2js').parseString;
const execSync = require('child_process').execSync;

let googlePhotoAccessToken;
let latestDate = new Date('1970/1/1');
let paperProcessRunning = false;

const googlePhotoAlbumID = process.env.google_photo_album_id;
const googlePhotoUserName = process.env.google_photo_user_name;
const paperAccessToken = process.env.paper_access_token;
const paperDocumentID = process.env.paper_document_id;

const controller = Botkit.slackbot( {
    debug: false
});

let fileName;
let fileComment;
let fileType;
let fileUploadUser;

let entryQueue = [];

controller.spawn({
    token: process.env.slack_token
}).startRTM();

controller.on('file_share', function(bot, message) {
  const fileURL = message.file.url_private_download;
	fileName = message.file.title;

	if(message.file.initial_comment) fileComment = ' / ' + message.file.initial_comment.comment;
	else fileComment = '';

	fileUploadUser = message.username;
	fileType = message.file.mimetype;

  const now = new Date();
  const diff = now.getTime() - latestDate.getTime();
  if((diff / (1000 * 60 * 60)) > 30) {
    getAccessToken();
    latestDate = new Date();
  }

  download(fileURL, process.env.slack_token)
    .then(upload)
    .then(enqueue)
    .then(() => {
      if(!paperProcessRunning) {
        paperProcessRunning = true;
        paperDocumentProcess();
      }
    });
});

function getAccessToken() {
	const result = execSync('sh ./get_access_token_by_refresh_token.sh').toString();
	let json;	
	eval('json = ' + result);
	googlePhotoAccessToken = json.access_token;
}

function paperDocumentProcess() {
  downloadPaperDocument()
    .then(modifyPaperDocument)
    .then(uploadPaperDocument)
    .then((response) => {
      for(let i=0; i<response.entryCount; i++) {
        entryQueue.shift();
      }
      if(entryQueue.length > 0) paperDocumentProcess();
      else paperProcessRunning = false;
    })
    .catch((error) => {
      paperDocumentProcess();
    });
}

function download(url, token) {
  return new Promise(function(resolve, reject) {
    request({method: 'get',
      url: url,
      encoding: null,
      headers: { Authorization: 'Bearer ' + token }
    }, function(error, response, body) {
      if(error) {
        reject(error);
      } else {
        resolve(body);
      }
    })
  });
}

// Google Photo にアップロードする
function upload(data) {
  return new Promise(function(resolve, reject) {
    let endPoint = 'https://picasaweb.google.com/data/feed/api/user/' + googlePhotoUserName + '/albumid/' + googlePhotoAlbumID;
    request({
      method: 'post',
      url: endPoint + '?access_token=' + googlePhotoAccessToken,
      body: data,
      headers: {
        'Content-Type': fileType,
        'Content-Length': '' + data.length,
        'Slug': 'slack_uploaded_image',
      },
    }, function(error, response, body) {
      if(error) {
        reject(error);
			} else {
				let json;
				parseXML(body, (err, result) => {
					if(err) {
						throw err;
					}	else {
						let imageURL = result.entry.content[0].$.src;
						resolve(imageURL.replace('slack_uploaded_image', 's10000/slack_uploaded_image'));
					}
				});
			}
    })
  })
}

function enqueue(url) {
  entryQueue.push(url);
}

function downloadPaperDocument() {
  return new Promise(function(resolve, reject) {
    request({
      method: 'get',
      url: 'https://api.dropboxapi.com/2/paper/docs/download',
			headers: {
				'Authorization': 'Bearer ' + paperAccessToken,
        'Dropbox-API-Arg': '{"doc_id": "' + paperDocumentID +'", "export_format": "markdown"}'
			}
		}, function(error, response, body) {
			if(error) {
				reject(error);
			} else {
				resolve(response);
			}
		});
	});
}

function modifyPaperDocument(response) {
	let temp;
	eval('temp = ' + response.caseless.dict['dropbox-api-result']);
	response.revision = temp.revision;

  response.entryCount = 0;
  response.modifiedDocument = response.body;
  for(let URL of entryQueue) {
    response.modifiedDocument = response.modifiedDocument + '![' + fileName + fileComment + ' from ' + fileUploadUser + '](' + URL + ')\n';
    response.entryCount++;
  }
  response.modifiedDocument = response.modifiedDocument.replace('# Album', 'Album');
  return Promise.resolve(response);
}

function uploadPaperDocument(response) {
  return new Promise(function(resolve, reject) {
    request({
      method: 'post',
      url: 'https://api.dropboxapi.com/2/paper/docs/update',
      body: response.modifiedDocument,
      headers: {
        "Content-Type": "application/octet-stream",
				'Authorization': 'Bearer ' + paperAccessToken,
        'Dropbox-API-Arg': '{"doc_id": "' + paperDocumentID + '", "doc_update_policy": "overwrite_all", "revision": ' + response.revision + ', "import_format": "markdown"}'
      },
    }, function(error, res, body) {
      if(error) {
        reject(error);
			} else {
				resolve(response);
			}
    })
  })
}

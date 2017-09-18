CLIENT_ID=""
CLIENT_SECRET=""
REFRESH_TOKEN=""

curl --data "refresh_token=${REFRESH_TOKEN}" --data "client_id=${CLIENT_ID}" --data "client_secret=${CLIENT_SECRET}" --data "grant_type=refresh_token" https://www.googleapis.com/oauth2/v4/token

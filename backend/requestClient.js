"use strict";
var requestClient = {};
requestClient.progressCount = 0;
requestClient.lastRequested = new Date();
requestClient.exceptUrls = [
	'/matchinfo/inquireSportsScores.do', '/matchinfo/inquireDetailedGameScore.do', '/matchinfo/inqAllot.do', '/matchinfo/inqLivetextGameList.do', '/gameinfo/liveText.do', '/gameinfo/baseballLivetext.do',
	'/buyPsblGame/gameInfoInq.do', '/gamebuy/inqCartGetAllots.do', '/gamebuy/stepVoteStatus.do', '/gamebuy/inqAllotMinMax.do'
];

requestClient.requestGetMethod = function(url, params, asyncFlag) {

	if(requestClient.exceptUrls.indexOf(url) < 0) requestClient.lastRequested = new Date();
	
    var result = null;

    if (params !== undefined) {
        url += "?" + requestClient.createParams(params);
    }
    
    $.ajax({
        type: "GET",
        url: url,
        dataType: "json",
        cache: false,
        async: typeof(asyncFlag) ===  "undefined" ? false : asyncFlag,
        beforeSend : requestClient.beforeProgressFn,		
        success: function(response) {
            result = response;
            requestClient.alertMessage(response.message);
        },
        error: function(e) {
            console.log(e);
        },
        complete : function(e){
        	requestClient.completeProgressFn();
        }
    });
    return result;
}



requestClient.requestPostMethod = function(url, params, asyncFlag, fnCallback, fnErrCallback) {
	
	if(requestClient.exceptUrls.indexOf(url) < 0) requestClient.lastRequested = new Date();
	
    var result = false;
    
    var debug = { "_sbmInfo" : {
		"debugMode" : "false"
	}};
    
    params['_sbmInfo'] = debug;
    
    $.ajax({
        type: "POST",
        url: url,
        //data:  JSON.stringify(params),
        //data : requestClient.removeEmojis(JSON.stringify(params)), // 입력필드 이모지 제거를 위한 func호출 ( 2020.12.02 추가 )
        data : JSON.stringify(params), // 입력필드 이모지 제거를 위한 func호출 ( 2020.12.02 추가 )
        dataType: "json",
        cache: false,
        async: typeof(asyncFlag) ===  "undefined" ? false : asyncFlag,
        contentType: "application/json; charset=UTF-8",
        beforeSend : requestClient.beforeProgressFn,
        success: function(response) {
            result = response;

            //requestClient.alertMessage(response.message);
            //console.log("ajax Post Success Callback Check ::",response);
            try {
            	fnCallback(response);
            } catch(e) {
            	console.log('error', e);
            }
        },
        error: function(e) {
            console.log(e);
            //에러페이지 처리를 위한 callbackfunction 추가
            try {
            	if(fnErrCallback != null && betmanOnlineFront.existFunctionCheck(fnErrCallback)) fnErrCallback(e);
            } catch(e) {
            	console.log('error', e);
            }
        },
        complete : function(e){
        	requestClient.completeProgressFn();
        }
    });

    return result;
}

requestClient.alertMessage = function(message) {
    if (message !== undefined && message !== null) {
        alert(message);
    }
}

requestClient.createParams = function(params) {
    var mappedParams = Object.map(params, function(key, value) {
        return key + "=" + value;
    });

    return Object.extended(mappedParams).values().join("&");
}

requestClient.beforeProgressFn = function(){
//	console.log('requestClient.beforeProgressFn', requestClient.progressCount);
	if( requestClient.isProgressEmpty() ){
		requestClient.progressCount += 1;
		
		// 0.5초 이내의 응답은 loading 중 layer를 보여주지 않도록 처리
		setTimeout(function(){
			if(requestClient.progressCount > 0) betLoader.go();
		}, 500);
	}else{
		requestClient.progressCount += 1;
	}
}

requestClient.completeProgressFn = function(){
//	console.log('requestClient.completeProgressFn', requestClient.progressCount);
	if( requestClient.progressCount > 1 ){
		requestClient.progressCount -= 1;
	}else{
		requestClient.progressCount -= 1;
		betLoader.end();
	}
}

requestClient.isProgressEmpty = function(){
	var progressDiv = $('.loading-block');
	return progressDiv.length > 0 ? false : true;
}

//입력필드 이모지 제거를 위한 func ( 2020.12.02 추가 )
//requestClient.removeEmojis = function(str){
//	const regex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;
//	return str.replace(regex, '');
//}
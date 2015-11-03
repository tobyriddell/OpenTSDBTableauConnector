(function() {
	// TODO: Need to add more parameters here - e.g. tags (and their values), rate (true/false)
	function buildOpenTSDBUri(metric, startTime, endTime) {
		var uri = "http://127.0.0.1:4242/api/query?start=" + startTime
				+ "&end=" + endTime + "&m=sum:rate:" + metric + "%7Bhost=*,type=user%7Csystem%7Ciowait%7D";
		return uri;
	}
	
	// Credit to Pointy
	// (http://stackoverflow.com/questions/10073699/pad-a-number-with-leading-zeros-in-javascript)
	function pad(n, width, z) {
		z = z || '0';
		n = n + '';
		return n.length >= width ? n : new Array(width - n.length + 1).join(z)
				+ n;
	}

	// Credit to shomrat
	// (http://stackoverflow.com/questions/847185/convert-a-unix-timestamp-to-time-in-javascript)
	function timeConverter(UNIX_timestamp) {
		var a = new Date(UNIX_timestamp * 1000);
		var months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug',
				'Sep', 'Oct', 'Nov', 'Dec' ];
		var year = a.getFullYear();
		var month = months[a.getMonth()];
		var date = a.getDate();
		var hour = a.getHours();
		var min = a.getMinutes();
		var sec = a.getSeconds();
		var timeStr = year + '-' + pad(month, 2) + '-' + pad(date, 2) + ' '
				+ pad(hour, 2) + ':' + pad(min, 2) + ':' + pad(sec, 2);

		return timeStr;
	}

	var myConnector = tableau.makeConnector();

	myConnector.getColumnHeaders = function() {
		var fieldNames = [ 'metric', 'timestamp', 'value' ];
		var fieldTypes = [ 'string', 'double', 'double' ];
		tableau.headersCallback(fieldNames, fieldTypes);
	};

	myConnector.getTableData = function(lastRecordToken) {
		var dataToReturn = [];
		var hasMoreData = false;
		var metric = tableau.connectionData;
		var startTime = $('.start_time').val();
		var endTime   = $('.end_time').val();
		var connectionUri = buildOpenTSDBUri(metric, startTime, endTime);

		console.log(connectionUri);
		tableau.log(connectionUri);

		var xhr = $
				.ajax({
					url : connectionUri,
					dataType : 'json',
					success : function(data) {

//						tableau.log(data);
//						tableau.log(data[0]);
//						tableau.log(data[0]['dps']);
						console.log("Data: ");
						console.log(data);
						if (data != null && data[0] != null && data[0]['dps'] != null) {
							console.log("data is not null");
							var timeSeries = data[0]['dps'];
							tableau.log(timeSeries);
							tableau.log(timeSeries.length);
							tableau.log(Object.keys(timeSeries).length);
							tableau.log(Object.keys(timeSeries));
							for ( var i in timeSeries) {
								tableau.log(i);
								tableau.log(timeSeries[i]);
								var entry = {
									'metric' : metric,
									'timestamp' : timeConverter(i),
									'value' : timeSeries[i]
								};
								tableau.log(entry);
								dataToReturn.push(entry);
							}

							tableau.log(dataToReturn);
							tableau.dataCallback(dataToReturn, lastRecordToken,
									false);
						} else {
							tableau
									.abortWithError("No results found for metric: "
											+ metric);
						}
					},
					error : function(xhr, ajaxOptions, thrownError) {
						// If the connection fails, log the error and return an empty set
						tableau.log("Connection error: " + xhr.responseText
								+ "\n" + thrownError);
						tableau
								.abortWithError("Error while trying to connect to OpenTSDB.");
					}
				});
	};

	tableau.registerConnector(myConnector);

	//      myConnector.init = function() {
	//        tableau.initCallback;
	//        tableau.submit;
	//    };

})();

$(document).ready(function() {
	$("#submitButton").click(function() {
		var metric = $('#metric').val().trim();
		if (metric) {
			tableau.connectionName = "Data for metric: " + metric;
			tableau.connectionData = metric;
			tableau.submit();
		}
	});
});

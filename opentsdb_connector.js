

$(function() {
	$('#datetimepicker1').datetimepicker({
			format: 'YYYY/MM/DD-HH:mm:ss'
		});
});

$(function() {
	$('#datetimepicker2').datetimepicker({
		format: 'YYYY/MM/DD-HH:mm:ss'
	});
});

function buildOpenTSDBUri(metric, startTime, endTime, tags) {
	var tagSet = []; // Start with empty array

	// Add "key=value" to the array for each tag in tags
	Object.keys(tags).forEach( function(key) {
		tagSet.push(key + "=" + tags[key])
	})

	// Turn into a comma-separated string
	var tagString = "";
	if ( tagSet.length > 0 ) {
		tagString = "%7B" + tagSet.join(",") + "%7D";
	}

	// Build the final uri
	var uri = "http://127.0.0.1:4242/api/query?start=" + startTime
			+ "&end=" + endTime + "&m=sum:rate:" + metric + tagString;
	return uri;
}

function buildEtagsUri(metric, startTime, endTime, tags) {
	var tagSet = []; // Start with empty array

	// Add "key=value" to the array for each tag in tags
	Object.keys(tags).forEach( function(key) {
		tagSet.push(key + "=" + tags[key])
	})

	// Turn into a comma-separated string
	var tagString = "";
	if ( tagSet.length > 0 ) {
		tagString = "%7B" + tagSet.join(",") + "%7D";
	}

	// Build the final uri
	var uri = "http://127.0.0.1:4242/q?start=" + startTime
			+ "&end=" + endTime + "&m=sum:rate:" + metric + tagString;
	return uri;
}

(function() {
	// TODO: Need to add more parameters here - e.g. tags (and their values), rate (true/false)	

	
	// http://127.0.0.1:4242/api/query?start=2015/10/28-05:48:10&end=2015/10/28-06:18:06&m=sum:rate:proc.net.tcp%7Bhost=*%7D&o=&yrange=%5B0:%5D&wxh=800x200&json
	// http://127.0.0.1:4242/api/query?start=2015/10/28-05:45:00&end=2015/10/28-06:15:00&m=sum:rate:proc.stat.cpu
	
	
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

	myConnector.getTableData = function(lastRecordToken) {
		var dataToReturn = [];
		var hasMoreData = false;

		var connectionData = JSON.parse(tableau.connectionData);
		var metric    = connectionData["metric"];
		var startTime = connectionData["startTime"];
		var endTime   = connectionData["endTime"];
		var tags  	  = connectionData["tags"];
		var connectionUri = buildOpenTSDBUri(metric, startTime, endTime, tags);

		console.log(connectionUri);
		tableau.log(connectionUri);

		var xhr = $
				.ajax({
					url : connectionUri,
					dataType : 'json',
					success : function(data) {
						if (data != null) {
							for (var int = 0; int < data.length; int++) {
								var timeseries = data[int];
								console.log("timeseries: ");
								console.log(timeseries);
								console.log("timeseries metric: " + timeseries['metric']);

								Object.keys(timeseries['dps']).forEach(function (key) {
									console.log(key + ":" + timeseries['dps'][key]);
									var entry = { 
											'metric' : timeseries['metric'],
											'timestamp': key,
											'value' : timeseries['dps'][key],
											'type' : timeseries['tags']['type']
									}
									dataToReturn.push(entry);
								})
							}

							tableau.dataCallback(dataToReturn, lastRecordToken,
									false);
						
//						if (data != null && data[0] != null && data[0]['dps'] != null) {
//							console.log("data is not null");
//							console.log(data);
//							var timeSeries = data[0]['dps'];
//							for ( var i in timeSeries) {
//								var entry = {
//									'metric' : metric,
//									'timestamp' : timeConverter(i),
//									'value' : timeSeries[i]
//								};
//								dataToReturn.push(entry);
//							}
//							tableau.dataCallback(dataToReturn, lastRecordToken,
//									false);
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

	
	myConnector.getColumnHeaders = function() {
		var fieldNames = ['metric', 'timestamp', 'value', 'type'];
		var fieldTypes = ['string', 'datetime', 'float', 'string'];
		tableau.headersCallback(fieldNames, fieldTypes);
	}

	tableau.registerConnector(myConnector);
	//      myConnector.init = function() {
	//        tableau.initCallback;
	//        tableau.submit;
	//    };

})();

$(document).ready(function() {
	$("#submitButton").click(function() {
		var metric = $('#metric').val().trim();
		var startTime = $('#datetimepicker1').data('date');
		var endTime = $('#datetimepicker2').data('date');
		var tags = {};

		if (metric) {
			tableau.connectionName = "Data for metric: " + metric;
			tableau.connectionData = JSON.stringify({'metric': metric, 'startTime': startTime, 'endTime': endTime, 'tags': tags});
			tableau.submit();
		}
	});

	$("#tagVal1").focus(function() {
	    console.log('in');
	}).blur(function() {
	    console.log('out');
	});

});
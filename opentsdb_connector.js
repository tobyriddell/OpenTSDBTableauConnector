$(function() {
	$('#start_datetime').datetimepicker({
			format: 'YYYY/MM/DD-HH:mm:ss'
		});
});

$(function() {
	$('#end_datetime').datetimepicker({
		format: 'YYYY/MM/DD-HH:mm:ss'
	});
});

function buildOpenTSDBUri(server, port, metric, startTime, endTime, tags) {
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
	var uri = "http://" + server + ":" + port + "/api/query?start=" + startTime
			+ "&end=" + endTime + "&m=sum:rate:" + metric + tagString;
	return uri;
}

function buildEtagsUri(server, port, metric, startTime, endTime) {
	// Build the final uri
	var etagsUri = "http://" + server + ":" + port + "/q?start=" + startTime
			+ "&end=" + endTime + "&m=sum:rate:" + metric + "&json";
	return etagsUri;
}

function buildTagsHtml(tags) {
	var tagsHtml = '<div id="tags"><p>Tags:</p><div class="tags">';
	var counter = 0;
//	console.log("In buildTagsHtml, tags is: ");
//	console.log(tags);
	Object.keys(tags).sort().forEach(function(t) {
		// Process tag name
//		console.log("Processing tag - name " + t);
		tagsHtml += '<div class="tagLine"><input class="tagName" type="text" id="tagName' + counter + '" value="' + t + '"/>';
//		console.log("Processing tag - value " + tags[t]);
		// Process tag value
		tagsHtml += '<input class="tagVal" type="text" id="tagVal' + counter + '" value="' + tags[t] + '"/></div>';
		counter += 1;
	});
	tagsHtml += '</div>';
//	console.log("tagsHtml: " + tagsHtml);
	return tagsHtml;
}

(function() {
	// TODO: Need to add more parameters here - e.g. tags (and their values), rate (true/false)	

	// http://127.0.0.1:4242/api/query?start=2015/10/28-05:48:10&end=2015/10/28-06:18:06&m=sum:rate:proc.net.tcp%7Bhost=*%7D&o=&yrange=%5B0:%5D&wxh=800x200&json
	// http://127.0.0.1:4242/api/query?start=2015/10/28-05:45:00&end=2015/10/28-06:15:00&m=sum:rate:proc.stat.cpu

	var myConnector = tableau.makeConnector();

	myConnector.getTableData = function(lastRecordToken) {
		var dataToReturn = [];
		var hasMoreData = false;

		var connectionData = JSON.parse(tableau.connectionData);

		var metric    = connectionData["metric"];
		var startTime = connectionData["startTime"];
		var endTime   = connectionData["endTime"];
		var tags  	  = connectionData["tags"];
		var server    = connectionData["server"];
		var port      = connectionData["port"];

		var metricUri = buildOpenTSDBUri(server, port, metric, startTime, endTime, tags);
		var etagsUri  = buildEtagsUri(server, port, metric, startTime, endTime);
		
//		console.log(metricUri);
//		tableau.log(metricUri);

		var xhr = $.ajax({
					url : metricUri,
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
						tableau.log("Connection error: " + xhr.responseText + "\n" + thrownError);
						tableau.abortWithError("Error while trying to connect to OpenTSDB.");
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
	var startTime;
	var endTime;
	var tags;
	var metric;
		
	// Define initial set of tags and insert into HTML
	var tags = { 'host': '*' };
	$('#tags').replaceWith(buildTagsHtml(tags));
	
	console.log("$(document).ready(...) called");
	
	function getTagsFromHtml() {
		// Gather current tag names/values from HTML (capture any fields modified by user)
		var tags = {};		
		$(".tagName").map( function(i, el) {
//			console.log("Tag name is: " + $("#tagName" + i).val());
//			console.log("Tag value is: " + $("#tagVal" + i).val());
			tags[$("#tagName" + i).val()] = $("#tagVal" + i).val();
		})
		
		return tags;
	}
	
	function registerCallbacks() {
		$('#tagVal1').focus(function() {
		    console.log('in');
		}).blur(function() {
		    console.log('out');
		    updatePage(tags);
		});

		// Register callback for when focus enters or exits one of the input fields (name or value), call updatePage() the focus exits
		$("input.tagVal").focus(function() {
		    console.log('in');
		}).blur(function() {
		    console.log('out');
		    updatePage(tags);
		});
	}
	
	function updatePage(tags) {
		var etagsUri;
		console.log("updatePage() called");
		
		metric = $('#metric').val().trim();
		console.log("Metric is " + metric);
		startTime = $('#start_datetime').data('date');
		endTime = $('#end_datetime').data('date');
		
		etagsUri = buildEtagsUri("127.0.0.1", "4242", metric, startTime, endTime);
//		console.log("etagsUri: " + etagsUri);
		tags = getTagsFromHtml();
		
		// Ensure there's a blank tag name/value pair in tags
		if ( ! $.inArray(' ', tags) > -1 ) {
			tags[''] = '';
		}
		
		jQuery.getJSON(etagsUri, function(data) {
//				console.log("(Inside getJSON) data: ");
//				console.log(tags);
//				console.log(data['etags'][0]);
				
				// Compare current tag names to what is returned from etags, add missing tag names (with tag value 
				// initially set to empty)
//				console.log("Retrieved tags:");
//				console.log(data['etags'][0]);
				data['etags'][0].forEach( function(tagName) {
						if ( ! (tagName in tags) ) {
							tags[tagName] = '';
//							console.log("Added '" + tagName + "' to tags");
						}
					}
				)
//				console.log("After query:")
//				console.log(tags);
				$('#tags').replaceWith(buildTagsHtml(tags));
				registerCallbacks();
			}
		)
	}
	
	$("#submitButton").click(function() {
		metric = $('#metric').val().trim();
		startTime = $('#start_datetime').data('date');
		endTime = $('#end_datetime').data('date');
		server = $('#server').val().trim();
		port = $('#port').val().trim();
		var tags = getTagsFromHtml();
		
		// Remove any tags with blank names and/or values
		delete tags[''];
		for (var name in tags) {
			if (tags[name] == '') {
				delete tags[name];
			}
		}

		console.log("After submit, tags: ");
		console.log(tags);
		
		if (metric) {
			tableau.connectionName = "Data for metric: " + metric;
			tableau.connectionData = JSON.stringify({'server': server, 'port': port, 'metric': metric, 
				'startTime': startTime, 'endTime': endTime, 'tags': tags});
			tableau.submit();
		}
	});

	// call 'updatePage()' when page has loaded to update tags
	updatePage(tags);
	registerCallbacks();
});
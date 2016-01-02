$(function() {
	$('#start_datetime').datetimepicker({ format: 'YYYY/MM/DD-HH:mm:ss'	});
});

$(function() {
	$('#end_datetime').datetimepicker({ format: 'YYYY/MM/DD-HH:mm:ss' });
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
	// Build HTML from preamble, tags and postamble
	var tagsHtml = '<div id="tags"><p>Tags:</p><div class="tags">' +
		Object.keys(tags).sort().map( function(t, i) {
		return '<div class="tagLine">' + 
			'<input class="tagName" type="text" id="tagName' + i + '" value="' + t + '"/>' +
			'<input class="tagVal" type="text" id="tagVal' + i + '" value="' + tags[t] + '"/>' + 
			'</div>';
	}).join('') + '</div>';
//	console.log('tagsHtml: ' + tagsHtml);
	return tagsHtml;
}

function getTagsFromHtml() {
	// Gather current tag names/values from HTML (capture any fields modified by user)
	var tags = {};		
	$(".tagName").map( function(i, el) {
		tags[$("#tagName" + i).val()] = $("#tagVal" + i).val();
	})
	
	return tags;
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
							// Initialise entry with static fields
							var entry = {
								'metric' : timeseries['metric'],
								'timestamp': key,
								'value' : timeseries['dps'][key],
							}
							// Add tags
							Object.keys(tags).forEach( function(t) {
//								console.log("Adding tag " + t + " to datapoint");
								entry[t] = timeseries['tags'][t];
							});
							dataToReturn.push(entry);
						})
					}

					tableau.dataCallback(dataToReturn, lastRecordToken,	false);
				} else {
					tableau.abortWithError("No results found for metric: " + metric);
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
		var connectionData = JSON.parse(tableau.connectionData);
		var tags  	       = connectionData["tags"];

		var fieldNames     = ['metric', 'timestamp', 'value']; // Initialise fields with the fixed values
		Object.keys(tags).forEach( function(t) { fieldNames.push(t); }); // Add tag names to fields

		var fieldTypes = ['string', 'datetime', 'float']; // Initialise field types with fixed values
		Object.keys(tags).forEach( function(t) { fieldTypes.push('string'); }); // Add tag types

		tableau.headersCallback(fieldNames, fieldTypes);
	}

	tableau.registerConnector(myConnector);
})();

function focusOnTags(focus) {
	console.log("Applying focus... (" + focus + ")");
	$(focus).focus();
}

$(document).ready(function() {
	var startTime;
	var endTime;
	var tags;
	var metric;
	var focus = "input#tagVal0.tagVal"; // Initial focus 
	
	// Define initial set of tags and insert into HTML
	var tags = { 'host': '*' };
	$('#tags').replaceWith(buildTagsHtml(tags));
	
	console.log("$(document).ready(...) called");
		
	function registerCallbacks() {
		$("input.tagVal").focus( function(e) {
			focus = e.target.localName + "#" + e.target.id + "." + e.target.className;
//			console.log("Focus set to " + focus);
		});
		
		$("input.tagVal").blur( function(e) {
//		    console.log('out');
		    updatePage(tags);
		});	
	}
		
	function updatePage(tags) {
//		console.log("updatePage() called");
//		console.trace();		
//		console.log('focus: ');
//		console.log(focus);
		
		metric = $('#metric').val().trim();
		console.log("Metric is " + metric);
		startTime = $('#start_datetime').data('date');
		endTime = $('#end_datetime').data('date');

		tags = getTagsFromHtml();
		// Ensure there's a blank tag name/value pair in tags, this allow a space for new tags to be entered
		if ( ! $.inArray(' ', tags) > -1 ) {
			tags[''] = '';
		}
		
		var etagsUri = buildEtagsUri("127.0.0.1", "4242", metric, startTime, endTime);
//		console.log("etagsUri: " + etagsUri);		
		jQuery.getJSON(etagsUri, function(data) {
			// Compare current tag names to what is returned from etags, add missing tag names (with tag value 
			// initially set to empty)
			data['etags'][0].forEach( function(tagName) {
				if ( ! (tagName in tags) ) {
					tags[tagName] = '';
				}
			})
			$('#tags').replaceWith(buildTagsHtml(tags));
			
			registerCallbacks();
		});
		
		if (focus) {
			$('#tags').ready(function() { console.log("#tags ready! Sleeping..."); setTimeout( function() { focusOnTags(focus); }, 100) });
		}
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

//		console.log("After submit, tags: ");
//		console.log(tags);
		
		if (metric) {
			tableau.connectionName = "Data for metric: " + metric;
			tableau.connectionData = JSON.stringify({'server': server, 'port': port, 'metric': metric, 
				'startTime': startTime, 'endTime': endTime, 'tags': tags});
			tableau.submit();
		}
	});

	// call 'updatePage()' when page has loaded to update tags
	updatePage(tags);
	// Re-register callback functions for focus() and blur()
	registerCallbacks();
});
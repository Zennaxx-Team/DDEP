$(document).ready(function () {
	let responseData = null;
	let perPage = 50;
	let currentPage = 1;
	$('#logs_new_data_table').show();
	$('#logs_data_table').hide();
	$('.endpoint_title').hide();

	let table = $('#logs_data_table').DataTable({
		order: [[5, 'asc']],
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: perPage,
		pagingType: "full_numbers",
		aoColumns: [
			null,
			null,
			null,
			null,
			null,
			null,
			null
		]
	});

	let newtable = $('#logs_new_data_table').DataTable({
		ordering: false,
		paging: false,
		searching: false,
		info: false,
		lengthChange: false,
	});

	getdata(parseInt(perPage), parseInt(currentPage));

	$('body').on('click', '#logs_data_table_paginate .paginate_button', function () {
		currentPage = $(this).attr('data-pageno');
		table.clear();
		table.destroy();
		table = $('#logs_data_table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: "full_numbers",
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				null,
				null
			]
		});
		let uniqueId = $('#unique_id').val();
		oldViewLogData(parseInt(perPage), parseInt(currentPage), '', uniqueId);
	});

	$('body').on('change', '#logs_data_table_length select', function () {
		perPage = $('#logs_data_table_length select').val();
		currentPage = 1;
		table.clear();
		table.destroy();
		table = $('#logs_data_table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: "full_numbers",
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				null,
				null
			]
		});
		let uniqueId = $('#unique_id').val();
		oldViewLogData(parseInt(perPage), parseInt(currentPage), '', uniqueId);
	});

	async function oldViewLogData(perPage, currentPage, searchItem, uniqueId) {
		$('body').find('#logs_data_table_paginate').show();
		$('body').find('#logs_data_table_info').show();
		$('#logs_data_table').show();

		await $.ajax({
			url: '/logs/logViewFullList',
			method: 'post',
			dataType: 'json',
			data: { page: parseInt(currentPage), limit: parseInt(perPage), type: 'log', searchItem, uniqueId },
			success: function (response) {
				responseData = response.data;
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				let totalRecord = parseInt(response.total);

				if (response.data.length <= 0) {
					$('#logs_data_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
				}

				$.each(response.data, function (index, data) {
					const startDate = new Date(data.createdAt);
					const startYear = startDate.getFullYear();
					const startMonth = startDate.getMonth() + 1;
					const startDay = startDate.getDate();
					const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
					const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
					const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
					const startMilliseconds = startDate.getMilliseconds();
					const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds;

					let $button_group = '<div class="btn-group" role="group" aria-label="Basic example">';
					if (data.datas && data.datas !== "") {
						$button_group += '<a href="#" class="btn btn-secondary" data-uniqueId="' + data._id + '">View</a>';
					}
					$button_group += '</div>';

					table.row.add([
						counter++,
						data.action || "",
						data.description || "",
						data.type || "",
						data.httpStatus || "",
						startTime || "",
						$button_group
					]).draw(false);
				});

				$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
				let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
				let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
				endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

				if (totalRecord == 0) {
					startEntry = 0;
				}

				let showpage = "Showing " + startEntry + " to " + endEntry + " of " + totalRecord + " entries";
				$('body').find('#logs_data_table_info').html(showpage);

				let dataDtIdx = 0;
				let paginationHtml = '';
				let firstDisable = (parseInt(currentPage) == 1) ? "disabled" : "";
				let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? "disabled" : "";

				if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
					paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="logs_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs_data_table_first_1" data-pageno="1">First</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="logs_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs_data_table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
					paginationHtml += '<span>';
					dataDtIdx++;

					if (parseInt(currentPage) > 2) {
						paginationHtml += '<a class="paginate_button" aria-controls="logs_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
						if (parseInt(currentPage) > 3) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						dataDtIdx++;
					}

					if ((parseInt(currentPage) - 1) > 0) {
						paginationHtml += '<a class="paginate_button" aria-controls="logs_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '<a class="paginate_button current" aria-controls="logs_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
					dataDtIdx++;

					if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
						paginationHtml += '<a class="paginate_button" aria-controls="logs_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
						dataDtIdx++;
					}

					if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
						if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						paginationHtml += '<a class="paginate_button" aria-controls="logs_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '</span>';
					paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="logs_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs_data_table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="logs_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="logs_data_table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
				}

				$('body').find('#logs_data_table_paginate').html(paginationHtml);
			},
			error: function (response) {
				console.log(response);
				alert('server error');
			}
		});
	}

	$('#log-details-page').on('click', async function () {
		let uniqueId = $(this).attr('data-uniqueid-log');

		$('.endpoint_title').hide();
		$('#logs_new_data_table').hide();

		if (!$('#logs_data_table').length) {
			console.error("Error: #logs_data_table not found in DOM");
			return;
		}

		$('#logs_data_table').show().parent().show();

		if ($.fn.DataTable.isDataTable('#logs_data_table')) {
			$('#logs_data_table').DataTable().destroy();
		}

		table = $('#logs_data_table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: "full_numbers",
			aoColumns: [
				null,
				null,
				null,
				null,
				null,
				null,
				null
			]
		});

		await oldViewLogData(perPage, currentPage, '', uniqueId);
	});

	async function getdata(perPage, currentPage) {
		let searchItem = getUrlParameter('itemid');
		let uniqueId = $('#unique_id').val();
		let logType = '';

		await $.ajax({
			url: '/logs/lastLogByUniqueId',
			method: 'post',
			dataType: 'json',
			data: { uniqueId },
			success: function (response) {
				responseData = response.data;
				logType = responseData.type
			},
			error: function (response) {
				console.log(response);
				alert('server error');
			}
		})

		table.clear();
		table.destroy();
		$('body').find('#logs_data_table_paginate').hide();
		$('body').find('#logs_data_table_info').hide();
		$('#logs_data_table').hide();
		$('#logs_new_data_table').show();
		$('.endpoint_title').show();

		if (logType === "FTP" || logType === "SFTP") {
			$('.hiddle_feilds').hide();
			$('#logs_data_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');
			await viewLogsforFtpView(perPage, currentPage, uniqueId, logType);
		} else {


			$('.hiddle_feilds').show();
			await $.ajax({
				url: '/logs/logNewViewFullList',
				method: 'post',
				dataType: 'json',
				data: { type: 'log', searchItem, uniqueId },
				success: function (response) {
					responseData = response.data;
					let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
					if (response.data.length <= 0) {
						$('#logs_new_data_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
					}

					if (response.partitionedData.length > 0) {
						let findurlEntryPoint = response.partitionedData[0].find((x) => x.action === "Inbound Get");
						if (findurlEntryPoint) {
							$('.inbound-entrypoint-value').text(findurlEntryPoint.datas);
						}
					}

					$('#log-details-page').attr('data-uniqueid-log', uniqueId);
					$('#log-curl-request, #log-curl-request-copy').prop('disabled', false);

					if (response.partitionedData.length > 0) {
						let curlrecord = response.partitionedData[0].find((x) => x.action === "Inbound Entrypoint");
						if (curlrecord && curlrecord.datas) {
							$('#log-curl-request').attr('data-uniqueid-curl-request', curlrecord.datas);
						} else {
							$('#log-curl-request, #log-curl-request-copy').prop('disabled', true);
						}
					}

					$.each(response.finalResponse, function (index, data) {
						// Initialize variables with empty strings or default values
						let outbound_endpoint = "";
						let time_consumed_ms = "";
						let status = "";
						let status_code = "";
						let request = "";
						let inboundMail = "";
						let transformed_request = "";
						let request_filter = "";
						let validation = "";
						let trigger_rule = "";
						let request_return_url = "";
						let response = "";
						let outboundMail = "";
						let transformed_response = "";
						let response_filter = "";
						let response_validation = "";
						let response_return_url = "";
						let outbound_entrypoint = "";

						// Safely assign values if exist
						if (data.outbound_endpoint) { outbound_endpoint = data.outbound_endpoint; }
						if (data.time_consumed_ms) { time_consumed_ms = data.time_consumed_ms; }
						if (data.status) { status = data.status; }
						if (data.status_code) { status_code = data.status_code; }
						if (data.request) { request = data.request; }
						if (data.transformed_request) { transformed_request = data.transformed_request; }
						if (data.request_filter) { request_filter = data.request_filter; }
						if (data.validation) { validation = data.validation; }
						if (data.trigger_rule) { trigger_rule = data.trigger_rule; }
						if (data.request_return_url) { request_return_url = data.request_return_url; }
						if (data.response) { response = data.response; }
						if (data.transformed_response) { transformed_response = data.transformed_response; }
						if (data.response_filter) { response_filter = data.response_filter; }
						if (data.response_validation) { response_validation = data.response_validation; }
						if (data.response_return_url) { response_return_url = data.response_return_url; }
						if (data.inboundMail && data.inboundMail.length > 0) { inboundMail = data.inboundMail }
						if (data.outboundMail && data.outboundMail.length > 0) { outboundMail = data.outboundMail }
						if (data.outbound_entrypoint) { outbound_entrypoint = data.outbound_entrypoint }

						let $button_group_request = '<div class="btn-group-vertical text-center" role="group">';
						if (request?.datas) {
							$button_group_request += createViewButton(request.datas);
						}
						if (inboundMail?.length) {
							$button_group_request += createEmailButton(inboundMail);
						}
						$button_group_request += '</div>';

						let $button_group_transformed_request = '';
						$button_group_transformed_request = '<div class="btn-group-vertical text-center" role="group">';
						if (transformed_request && transformed_request.datas) {
							$button_group_transformed_request += createViewButton(transformed_request.datas);
						}
						if (transformed_request && transformed_request.message) {
							$button_group_transformed_request += `<span class="text-center mt-1 w-100">${transformed_request.message}</span>`;
						}
						$button_group_transformed_request += '</div>';

						let $button_group_request_filter = '<div class="btn-group-vertical text-center" role="group">';
						if (request_filter?.datas) {
							$button_group_request_filter += createViewButton(request_filter.datas);
						}
						if (request_filter?.message) {
							$button_group_request_filter += `<span class="text-center mt-1 w-100">${request_filter.message}</span>`;
						}
						$button_group_request_filter += '</div>';

						let $button_group_validation = '<div class="btn-group-vertical text-center" role="group">';
						if (validation?.datas) {
							$button_group_validation += createViewButton(validation.datas);
						}
						if (validation?.message) {
							$button_group_validation += `<span class="text-center mt-1 w-100">${validation.message}</span>`;
						}
						$button_group_validation += '</div>';

						// Trigger Rule
						let $button_group_trigger_rule = '<div class="btn-group-vertical text-center" role="group">';
						if (trigger_rule?.datas) {
							$button_group_trigger_rule += createViewButton(trigger_rule.datas);
						}
						if (trigger_rule?.message) {
							$button_group_trigger_rule += `<span class="text-center mt-1 w-100">${trigger_rule.message}</span>`;
						}
						$button_group_trigger_rule += '</div>';

						// Request Return URL
						let $button_group_request_return_url = '<div class="btn-group-vertical text-center" role="group">';
						if (request_return_url?.datas) {
							$button_group_request_return_url += createViewButton(request_return_url.datas);
						}
						if (request_return_url?.message) {
							$button_group_request_return_url += `<span class="text-center mt-1 w-100">${request_return_url.message}</span>`;
						}
						$button_group_request_return_url += '</div>';

						// Curl Base
						let $button_group_curl_base = '<div class="btn-group-vertical text-center" role="group">';
						if (outbound_entrypoint?.datas) {
							$button_group_curl_base += createViewButton(outbound_entrypoint.datas, "curl");
						}
						if (outbound_entrypoint?.message) {
							$button_group_curl_base += `<span class="text-center mt-1 w-100">${outbound_entrypoint.message}</span>`;
						}
						$button_group_curl_base += '</div>';


						// Response
						let $button_group_response = '<div class="btn-group-vertical text-center" role="group">';
						if (response?.datas) {
							$button_group_response += createViewButton(response.datas);
						}
						if (outboundMail?.length) {
							$button_group_response += createEmailButton(outboundMail);
						}
						if (response?.message) {
							$button_group_response += `<span class="text-center mt-1 w-100">${response.message}</span>`;
						}
						$button_group_response += '</div>';

						// Transformed Response
						let $button_group_transformed_response = '<div class="btn-group-vertical text-center" role="group">';
						if (transformed_response?.datas) {
							$button_group_transformed_response += createViewButton(transformed_response.datas);
						}
						if (transformed_response?.message) {
							$button_group_transformed_response += `<span class="text-center mt-1 w-100">${transformed_response.message}</span>`;
						}
						$button_group_transformed_response += '</div>';

						// Response Filter
						let $button_group_response_filter = '<div class="btn-group-vertical text-center" role="group">';
						if (response_filter?.datas) {
							$button_group_response_filter += createViewButton(response_filter.datas);
						}
						if (response_filter?.message) {
							$button_group_response_filter += `<span class="text-center mt-1 w-100">${response_filter.message}</span>`;
						}
						$button_group_response_filter += '</div>';

						// Response Validation
						let $button_group_response_validation = '<div class="btn-group-vertical text-center" role="group">';
						if (response_validation?.datas) {
							$button_group_response_validation += createViewButton(response_validation.datas);
						}
						if (response_validation?.message) {
							$button_group_response_validation += `<span class="text-center mt-1 w-100">${response_validation.message}</span>`;
						}
						$button_group_response_validation += '</div>';

						// Response Return URL
						let $button_group_response_return_url = '<div class="btn-group-vertical text-center" role="group">';
						if (response_return_url?.datas) {
							$button_group_response_return_url += createViewButton(response_return_url.datas);
						}
						if (response_return_url?.message) {
							$button_group_response_return_url += `<span class="text-center mt-1 w-100">${response_return_url.message}</span>`;
						}
						$button_group_response_return_url += '</div>';

						// Add row to DataTable matching the 15 columns you provided
						newtable.row.add([
							counter++,             // No
							outbound_endpoint,     // Outbound Endpoint
							time_consumed_ms,      // TIME CONSUMED (MS)
							status,                // STATUS
							status_code,           // STATUS CODE
							$button_group_curl_base,
							$button_group_request,               // REQUEST
							$button_group_transformed_request,   // TRANSFORMED REQUEST
							$button_group_request_filter,        // REQUEST FILTER
							$button_group_validation,            // VALIDATION
							$button_group_trigger_rule,        	 // TRIGGER RULES
							$button_group_request_return_url,    // REQUEST RETURN URL
							$button_group_response,              // RESPONSE
							$button_group_transformed_response,  // TRANSFORMED RESPONSE
							$button_group_response_filter,       // RESPONSE FILTER
							$button_group_response_validation,   // RESPONSE VALIDATION
							$button_group_response_return_url    // RESPONSE RETURN URL
						]).draw(false);
					});
				},
				error: function (response) {
					console.log(response);
					alert('server error');
				}
			});
		}
	}

	async function viewLogsforFtpView(perPage, currentPage, uniqueId, logType) {
		await $.ajax({
			url: '/logs/logNewViewFullListForftp',
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ type: 'log', uniqueId }),
			success: function (response) {
				responseData = response.data;
				resViewlogTotalRecords = parseInt(response.total);
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				let totalRecord = parseInt(response.total);

				if (response.data.length <= 0) {
					$('#view-new-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
				}

				if (response.partitionedData.length > 0) {
					let findurlEntryPoint = response.partitionedData[0].find((x) => x.action === "Entrypoint Get");
					if (findurlEntryPoint) {
						$('.inbound-entrypoint-value').text(findurlEntryPoint.description);
					}
				}

				$('#log-details-page').attr('data-uniqueid-log', uniqueId);

				$.each(response.finalResponse, function (index, data) {
					let outbound_endpoint = "";
					let time_consumed_ms = "";
					let status = "";
					let status_code = "";
					let request = "";
					let inboundMail = "";
					let transformed_request = "";
					let request_filter = "";
					let validation = "";
					let trigger_rule = "";
					let request_return_url = "";
					let response = "";
					let outboundMail = "";
					let transformed_response = "";
					let response_filter = "";
					let response_validation = "";
					let response_return_url = "";
					let outbound_entrypoint = "";

					// Safely assign values if exist
					if (data.outbound_endpoint) { outbound_endpoint = data.outbound_endpoint; }
					if (data.time_consumed_ms) { time_consumed_ms = data.time_consumed_ms; }
					if (data.status) { status = data.status; }
					if (data.status_code) { status_code = data.status_code; }
					if (data.request) { request = data.request; }
					if (data.transformed_request) { transformed_request = data.transformed_request; }
					if (data.request_filter) { request_filter = data.request_filter; }
					if (data.validation) { validation = data.validation; }
					if (data.trigger_rule) { trigger_rule = data.trigger_rule; }
					if (data.request_return_url) { request_return_url = data.request_return_url; }
					if (data.response) { response = data.response; }
					if (data.transformed_response) { transformed_response = data.transformed_response; }
					if (data.response_filter) { response_filter = data.response_filter; }
					if (data.response_validation) { response_validation = data.response_validation; }
					if (data.response_return_url) { response_return_url = data.response_return_url; }
					if (data.inboundMail && data.inboundMail.length > 0) { inboundMail = data.inboundMail }
					if (data.outboundMail && data.outboundMail.length > 0) { outboundMail = data.outboundMail }
					if (data.outbound_entrypoint) { outbound_entrypoint = data.outbound_entrypoint }

					let $button_group_request = '<div class="btn-group-vertical text-center" role="group">';
					if (request?.datas) {
						$button_group_request += createViewButton(request.datas);
					}
					if (inboundMail?.length) {
						$button_group_request += createEmailButton(inboundMail);
					}
					$button_group_request += '</div>';

					let $button_group_transformed_request = '';
					$button_group_transformed_request = '<div class="btn-group-vertical text-center" role="group">';
					if (transformed_request && transformed_request.datas) {
						$button_group_transformed_request += createViewButton(transformed_request.datas);
					}
					if (transformed_request && transformed_request.message) {
						$button_group_transformed_request += `<span class="text-center mt-1 w-100">${transformed_request.message}</span>`;
					}
					$button_group_transformed_request += '</div>';

					let $button_group_request_filter = '<div class="btn-group-vertical text-center" role="group">';
					if (request_filter?.datas) {
						$button_group_request_filter += createViewButton(request_filter.datas);
					}
					if (request_filter?.message) {
						$button_group_request_filter += `<span class="text-center mt-1 w-100">${request_filter.message}</span>`;
					}
					$button_group_request_filter += '</div>';

					let $button_group_validation = '<div class="btn-group-vertical text-center" role="group">';
					if (validation?.datas) {
						$button_group_validation += createViewButton(validation.datas);
					}
					if (validation?.message) {
						$button_group_validation += `<span class="text-center mt-1 w-100">${validation.message}</span>`;
					}
					$button_group_validation += '</div>';

					// Trigger Rule
					let $button_group_trigger_rule = '<div class="btn-group-vertical text-center" role="group">';
					if (trigger_rule?.datas) {
						$button_group_trigger_rule += createViewButton(trigger_rule.datas);
					}
					if (trigger_rule?.message) {
						$button_group_trigger_rule += `<span class="text-center mt-1 w-100">${trigger_rule.message}</span>`;
					}
					$button_group_trigger_rule += '</div>';

					// Request Return URL
					let $button_group_request_return_url = '<div class="btn-group-vertical text-center" role="group">';
					if (request_return_url?.datas) {
						$button_group_request_return_url += createViewButton(request_return_url.datas);
					}
					if (request_return_url?.message) {
						$button_group_request_return_url += `<span class="text-center mt-1 w-100">${request_return_url.message}</span>`;
					}
					$button_group_request_return_url += '</div>';

					// Curl Base
					let $button_group_curl_base = '<div class="btn-group-vertical text-center" role="group">';
					if (outbound_entrypoint?.datas) {
						$button_group_curl_base += createViewButton(outbound_entrypoint.datas, "curl");
					}
					if (outbound_entrypoint?.message) {
						$button_group_curl_base += `<span class="text-center mt-1 w-100">${outbound_entrypoint.message}</span>`;
					}
					$button_group_curl_base += '</div>';


					// Response
					let $button_group_response = '<div class="btn-group-vertical text-center" role="group">';
					if (response?.datas) {
						$button_group_response += createViewButton(response.datas);
						$button_group_response += createEmailButton(outboundMail);
					}
					if (response?.message) {
						$button_group_response += `<span class="text-center mt-1 w-100">${response.message}</span>`;
					}
					$button_group_response += '</div>';

					// Transformed Response
					let $button_group_transformed_response = '<div class="btn-group-vertical text-center" role="group">';
					if (transformed_response?.datas) {
						$button_group_transformed_response += createViewButton(transformed_response.datas);
					}
					if (transformed_response?.message) {
						$button_group_transformed_response += `<span class="text-center mt-1 w-100">${transformed_response.message}</span>`;
					}
					$button_group_transformed_response += '</div>';

					// Response Filter
					let $button_group_response_filter = '<div class="btn-group-vertical text-center" role="group">';
					if (response_filter?.datas) {
						$button_group_response_filter += createViewButton(response_filter.datas);
					}
					if (response_filter?.message) {
						$button_group_response_filter += `<span class="text-center mt-1 w-100">${response_filter.message}</span>`;
					}
					$button_group_response_filter += '</div>';

					// Response Validation
					let $button_group_response_validation = '<div class="btn-group-vertical text-center" role="group">';
					if (response_validation?.datas) {
						$button_group_response_validation += createViewButton(response_validation.datas);
					}
					if (response_validation?.message) {
						$button_group_response_validation += `<span class="text-center mt-1 w-100">${response_validation.message}</span>`;
					}
					$button_group_response_validation += '</div>';

					// Response Return URL
					let $button_group_response_return_url = '<div class="btn-group-vertical text-center" role="group">';
					if (response_return_url?.datas) {
						$button_group_response_return_url += createViewButton(response_return_url.datas);
					}
					if (response_return_url?.message) {
						$button_group_response_return_url += `<span class="text-center mt-1 w-100">${response_return_url.message}</span>`;
					}
					$button_group_response_return_url += '</div>';


					// Add row to DataTable matching the 15 columns you provided
					newtable.row.add([
						counter++,             // No
						outbound_endpoint,     // Outbound Endpoint
						time_consumed_ms,      // TIME CONSUMED (MS)
						status,                // STATUS
						status_code,           // STATUS CODE
						$button_group_curl_base,
						$button_group_request,               // REQUEST
						$button_group_transformed_request,   // TRANSFORMED REQUEST
						$button_group_request_filter,        // REQUEST FILTER
						$button_group_validation,            // VALIDATION
						$button_group_trigger_rule,        	 // TRIGGER RULES
						$button_group_request_return_url,    // REQUEST RETURN URL
						$button_group_response,              // RESPONSE
						$button_group_transformed_response,  // TRANSFORMED RESPONSE
						$button_group_response_filter,       // RESPONSE FILTER
						$button_group_response_validation,   // RESPONSE VALIDATION
						$button_group_response_return_url    // RESPONSE RETURN URL
					]).draw(false);
				});
				viewLogsItemId = uniqueId;
				viewLogsType = logType;
				$('#view-new-item-logs-modal-slide-in').modal('show');
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });
			},
			error: function (xhr, status, error) {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({ 'display': 'none' });

				Swal.fire({
					title: 'Error!',
					text: xhr?.responseJSON?.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});

				return false;
			}
		});
	}

	$('#log-curl-request').on('click', function () {
		let curlRequest = $(this).attr('data-uniqueid-curl-request');
		$('#details-curl-base').text(curlRequest);
		$('#view-curl-bash-slide-in').modal('show');
	});

	$('#copy-content-btn').on('click', function () {
		let curlRequest = $('#log-req-res-request').attr('data-uniqueid-curl-request');
		navigator.clipboard.writeText(curlRequest)
			.then(() => {
				Swal.fire({
					title: 'Success!',
					text: "Request copied to clipboard",
					icon: 'success',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			})
			.catch(err => {
				Swal.fire({
					title: 'Error!',
					text: err.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			});
	});

	$('#copy-curl-btn').on('click', function () {
		let curlRequest = $('#log-curl-request').attr('data-uniqueid-curl-request');
		navigator.clipboard.writeText(curlRequest)
			.then(() => {
				Swal.fire({
					title: 'Success!',
					text: "Request copied to clipboard",
					icon: 'success',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			})
			.catch(err => {
				Swal.fire({
					title: 'Error!',
					text: err.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			});
	});

	$('#log-curl-request-copy').on('click', function () {
		let curlRequest = $('#log-curl-request').attr('data-uniqueid-curl-request');
		navigator.clipboard.writeText(curlRequest)
			.then(() => {
				Swal.fire({
					title: 'Success!',
					text: "Request copied to clipboard",
					icon: 'success',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			})
			.catch(err => {
				Swal.fire({
					title: 'Error!',
					text: err.message,
					icon: 'error',
					customClass: {
						confirmButton: 'btn btn-primary'
					},
					buttonsStyling: false,
					timer: 1200
				});
			});
	});

	function getUrlParameter(sParam) {
		let sPageURL = window.location.search.substring(1),
			sURLVariables = sPageURL.split('&'),
			sParameterName,
			i;

		for (i = 0; i < sURLVariables.length; i++) {
			sParameterName = sURLVariables[i].split('=');

			if (sParameterName[0] === sParam) {
				return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
			}
		}
		return "";
	}

	$('body').on('click', 'a[data-uniqueId]', function (event) {
		event.preventDefault();
		const uniqueId = $(this).attr('data-uniqueId');
		const dataObject = responseData.find(item => item._id === uniqueId);
		if (dataObject?.description == "User Posting Data" || dataObject?.description == "Mapped Data" || dataObject?.description == "Response Data" || dataObject.description == "CURL Bash") {
			$('#copy-content-btn').show();
		} else {
			$('#copy-content-btn').hide();
		}
		let datas;
		try {
			datas = JSON.parse(dataObject.datas);
		} catch (e) {
			datas = dataObject.datas;
		}
		const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;
		$('#details-modal-body').text(formattedData);
		$('#log-req-res-request').attr('data-uniqueid-curl-request', formattedData);
		$('#details-modal-body').show();

		$('#table-content').hide();
		$('#details-modal').modal('show');
	});
});

function createViewButton(datas, request) {
	if (!datas) return '';

	let parsedDatas;
	try {
		parsedDatas = typeof datas === 'string' ? JSON.parse(datas) : datas;
	} catch (e) {
		parsedDatas = datas;
	}

	// Safely stringify and escape quotes for HTML attribute
	const requestJson = JSON.stringify(parsedDatas).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

	return `<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="View" data-request='${requestJson}' data-curl='${request}' onclick="viewItemLogDetailsModel(this.getAttribute('data-request'), this.getAttribute('data-curl'))">
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>`;
}

function createEmailButton(datas) {
	if (!datas) return '';
	return `<button type="button" class="btn btn-outline-secondary mt-1" data-toggle="tooltip" title="View" data-request='${JSON.stringify(datas)}' onclick="viewEmailLogDetails(this.getAttribute('data-request'))">
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
			viewBox="0 0 24 24" fill="none" stroke="currentColor" 
			stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
			class="feather feather-mail">
			<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4
			c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
			<polyline points="22,6 12,13 2,6"></polyline>
		</svg></button>`;
}

function partitionByInboundUserPosting(data) {
	const result = [];
	let currentPartition = [];

	for (const item of data) {
		if (item.action === "Inbound User Posting") {
			if (currentPartition.length > 0) {
				result.push(currentPartition);
				currentPartition = [];
			}
		}
		currentPartition.push(item);
	}

	if (currentPartition.length > 0) {
		result.push(currentPartition);
	}

	return result;
}

function viewItemLogDetailsModel(datasString, curl) {
	$('#copy-content-btn').show();
	if (curl !== "undefined") {
		let datas;
		try {
			datas = JSON.parse(datasString);
		} catch (e) {
			datas = datasString;
		}
		const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;
		$('#details-curl-base').text(formattedData);
		$('#log-curl-request').attr('data-uniqueid-curl-request', formattedData);
		$('#view-curl-bash-slide-in').modal('show');
	} else {
		let datas;
		try {
			datas = JSON.parse(datasString);
		} catch (e) {
			datas = datasString;
		}
		const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;

		$('#details-modal-body').show();
		$('#table-content').hide();
		$('#details-modal-body').text(formattedData);
		$('#log-req-res-request').attr('data-uniqueid-curl-request', formattedData);
		$('#details-modal').modal('show');
	}
}

let emailLogsTable; // renamed from viewLogsTable

function viewEmailLogDetails(emailLogs) {
	let emailLog;
	try {
		emailLog = JSON.parse(emailLogs);
	} catch (e) {
		console.error("Invalid JSON:", e);
		return;
	}

	$('#details-modal-body').hide();
	$('#table-content').show();

	// Inject table into modal body
	$('#table-content').html(`
		<table class="datatables-basic table" id="email-logs-table">
			<thead>
				<tr>
					<th>No</th>
					<th>Action</th>
					<th>Description</th>
					<th>Type</th>
					<th>Http Status</th>
					<th>Time</th>
					<th>Details</th>
				</tr>
			</thead>
			<tbody></tbody>
		</table>
	`);

	// Destroy previous instance if exists
	if ($.fn.DataTable.isDataTable('#email-logs-table')) {
		$('#email-logs-table').DataTable().destroy();
	}

	// Bind to DataTable
	emailLogsTable = $('#email-logs-table').DataTable({
		columns: [
			{ title: "No" },
			{ title: "Action" },
			{ title: "Description" },
			{ title: "Type" },
			{ title: "Http Status" },
			{ title: "Time" },
			{ title: "Details" }
		],
		ordering: false,
		paging: false,
		searching: false,
		info: false,
		lengthChange: false
	});

	$.each(emailLog, function (index, data) {
		const startDate = new Date(data.createdAt);
		const startYear = startDate.getFullYear();
		const startMonth = startDate.getMonth() + 1;
		const startDay = startDate.getDate();
		const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
		const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
		const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
		const startMilliseconds = startDate.getMilliseconds();
		const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds;

		let $button_group = '<div class="btn-group" role="group" aria-label="Action Buttons">';
		if (data.datas && data.datas !== "") {
			$button_group += '<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="View" data-uniqueId="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
		}
		$button_group += '</div>';

		emailLogsTable.row.add([
			index + 1,
			data.action,
			data.description,
			data.type,
			data.httpStatus || '',
			startTime,
			$button_group
		]).draw(false);
	});

	$('#copy-content-btn').hide();
	// Show modal
	$('#details-modal').modal('show');
}
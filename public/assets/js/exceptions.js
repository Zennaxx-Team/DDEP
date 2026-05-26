$(document).ready(function() {
	let detailsUniqueId = null,
	perPage = 50,
	currentPage = 1,
	table = $('#exception_data_table').DataTable({
		order: [[0, 'desc']],
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: perPage,
		pagingType: 'full_numbers',
		aoColumns: [
			null,
			null,
			{ 'sClass': 'line-break-anywhare' },
			null,
			null,
			null,
			null
		]
	});

	getdata(parseInt(perPage), parseInt(currentPage));

	$('body').on('click', '#exception_data_table_paginate .paginate_button', function() {
		currentPage = $(this).attr('data-pageno');
		table.clear();
		table.destroy();
		table = $('#exception_data_table').DataTable({
			order: [[0, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			aoColumns: [
				null,
				null,
				{ 'sClass': 'line-break-anywhare' },
				null,
				null,
				null,
				null
			]
		});

		getdata(parseInt(perPage), parseInt(currentPage));
	});

	$('body').on('change', '#exception_data_table_length select', function() {
		perPage = $('#exception_data_table_length select').val();
		currentPage = 1;
		table.clear();
		table.destroy();
		table = $('#exception_data_table').DataTable({
			order: [[0, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			aoColumns: [
				null,
				null,
				{ 'sClass': 'line-break-anywhare' },
				null,
				null,
				null,
				null
			]
		});

		getdata(parseInt(perPage), parseInt(currentPage));
	});

	function getdata(perPage, currentPage) {
		let searchItem = getUrlParameter('itemid');
		$('#exception_data_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

		$.ajax({
			url: '/logs/logFullList',
			method: 'post',
			dataType: 'json',
			data: {page: parseInt(currentPage), limit: parseInt(perPage), type: 'exception', searchItem: searchItem},
			success: function(response) {
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				let totalRecord = parseInt(response.total);

				if (response.data.length <= 0) {
					$('#exception_data_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
				}

				$.each(response.data, function(index, data) {
					const startDate = new Date(data.createdAt);
					const startYear = startDate.getFullYear();
					const startMonth = startDate.getMonth() + 1;
					const startDay = startDate.getDate();
					const startHours = (startDate.getHours() < 10 ? '0' : '') + startDate.getHours();
					const startMinutes = (startDate.getMinutes() < 10 ? '0' : '') + startDate.getMinutes();
					const startSeconds = (startDate.getSeconds() < 10 ? '0' : '') + startDate.getSeconds();
					const startMilliseconds = (startDate.getMilliseconds() < 10 ? '00' : (startDate.getMilliseconds() < 100 ? '0' : '')) + startDate.getMilliseconds();
					const startTime = startYear + '-' + (startMonth < 10 ? '0' : '') + startMonth + '-' + (startDay < 10 ? '0' : '') + startDay + ' ' + startHours + ':' + startMinutes + ':' + startSeconds + '.' + startMilliseconds;

					const dataItem = data.item || "";
					const itemName = '<a href="#" data-uniqueId="' + data.unique_id + '">' + dataItem + '</a>';

					table.row.add([
						startTime,
						data.exception_type || "",
						data?.last_end_log_history?.path || "",
						data.project || "",
						itemName,
						data.description || "",
						data.detail_exception || ""
					]).draw(false);
				});

				$(".connection-error").html(response.connectionErrorTotal);
				$(".formula-error").html(response.formulaErrorTotal);
				$(".system-error").html(response.systemErrorTotal);

				$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
				let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
				let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
				endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

				if (totalRecord == 0) {
					startEntry = 0;
				}

				let showpage = "Showing " + startEntry + " to " + endEntry + " of " + totalRecord + " entries";
				$('body').find('#exception_data_table_info').html(showpage);

				let dataDtIdx = 0;
				let paginationHtml = '';
				let firstDisable = (parseInt(currentPage) == 1) ? "disabled" : "";
				let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? "disabled" : "";

				if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
					paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="exception_data_table_first_1" data-pageno="1">First</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="exception_data_table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
					paginationHtml += '<span>';
					dataDtIdx++;

					if (parseInt(currentPage) > 2) {
						paginationHtml += '<a class="paginate_button" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
						if (parseInt(currentPage) > 3) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						dataDtIdx++;
					}

					if ((parseInt(currentPage) - 1) > 0) {
						paginationHtml += '<a class="paginate_button" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '<a class="paginate_button current" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
					dataDtIdx++;

					if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
						paginationHtml += '<a class="paginate_button" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
						dataDtIdx++;
					}

					if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
						if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						paginationHtml += '<a class="paginate_button" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '</span>';
					paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="exception_data_table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="exception_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="exception_data_table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
				}

				$('body').find('#exception_data_table_paginate').html(paginationHtml);
			},
			error: function(response) {
				console.log(response);
				alert('server error');
			}
		});
	}

	$('body').on('keyup', '#serach_error_type', function() {
		let countHide = 1;
		let value = $(this).val();
		const rowCount = $('#exception_error_type_table tbody tr').length;

		$('#exception_error_type_table tbody tr').each(function(index) {
			if (index != 0) {
				$row = $(this);
				let tdText = $row.find('td:first').text();
				tdText = tdText.toLowerCase();

				if (tdText.indexOf(value) != 0) {
					$(this).hide();
					countHide++;
				} else {
					$('#exception_error_type_table tbody tr:first').hide();
					$(this).show();
				}
			}
		});

		if (rowCount == countHide) {
			$('#exception_error_type_table tbody tr:first').show();
		}
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
		return '';
	}

	let detailsperPage = 50;
	let detailscurrentPage = 1;
	let detailsTable = $('#logs_data_table').DataTable({
		order: [[5, 'asc']],
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: detailsperPage,
		pagingType: 'full_numbers',
	});

	$('body').on('click', '#exception_data_table a[data-uniqueId]', function(event) {
		event.preventDefault();
		detailsUniqueId = $(this).attr('data-uniqueId');

		detailsperPage = 50;
		detailscurrentPage = 1;
		detailsTable.clear();
		detailsTable.destroy();
		detailsTable = $('#logs_data_table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: detailsperPage,
			pagingType: 'full_numbers',
		});
		getDetailsData(parseInt(detailsperPage), parseInt(detailscurrentPage));

		$('#exception-details-modal').modal('show');
	});

	$('body').on('click', '#logs_data_table_paginate .paginate_button', function() {
		detailscurrentPage = $(this).attr('data-pageno');
		detailsTable.clear();
		detailsTable.destroy();
		detailsTable = $('#logs_data_table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: detailsperPage,
			pagingType: 'full_numbers',
		});
		getDetailsData(parseInt(detailsperPage), parseInt(detailscurrentPage));
	});

	$('body').on('change', '#logs_data_table_length select', function() {
		detailsperPage = $('#logs_data_table_length select').val();
		detailscurrentPage = 1;
		detailsTable.clear();
		detailsTable.destroy();
		detailsTable = $('#logs_data_table').DataTable({
			order: [[5, 'asc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: detailsperPage,
			pagingType: 'full_numbers',
		});
		getDetailsData(parseInt(detailsperPage), parseInt(detailscurrentPage));
	});

	function getDetailsData(perPage, currentPage) {
		let searchItem = getUrlParameter('itemid');
		let uniqueId = detailsUniqueId;
		$('#logs_data_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

		$.ajax({
			url: '/logs/logViewFullList',
			method: 'post',
			dataType: 'json',
			data: {page: parseInt(currentPage), limit: parseInt(perPage), type: 'log', searchItem, uniqueId},
			success: function(response) {
				responseData = response.data;
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				let totalRecord = parseInt(response.total);

				if (response.data.length <= 0) {
					$('#logs_data_table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
				}

				$.each(response.data, function(index, data) {
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

					detailsTable.row.add([
						counter++,
						data.action,
						data.description,
						data.type,
						data.httpStatus || "",
						startTime,
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
			error: function(response) {
				console.log(response);
				alert('server error');
			}
		});
	}

	$('body').on('click', '#logs_data_table a[data-uniqueId]', function(event) {
		event.preventDefault();
		const uniqueId = $(this).attr('data-uniqueId');
		const dataObject = responseData.find(item => item._id === uniqueId);
		let datas;
		try {
			datas = JSON.parse(dataObject.datas);
		} catch (e) {
			datas = dataObject.datas;
		}
		const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;
		$('#details-modal #details-modal-body').text(formattedData);
		$('#details-modal').modal('show');
	});
});
$(document).ready(function() {
	let perPage = 50;
	let currentPage = 1;
	let table = $('#logs_data_table').DataTable({
		order: [[7, 'desc']],
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: perPage,
		pagingType: "full_numbers",
		aoColumns: [
			null,
			null,
			null,
			null,
			{ "sClass": "line-break-anywhare" },
			null,
			null,
			null,
			null,
			null,
			null
		]
	});

	const form = document.getElementById("logs_import");

	form.addEventListener("submit", submitForm);

	function submitForm(e) {
		e.preventDefault();
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({'display':'block'});

		const files = document.getElementById("log_file");
		const formData = new FormData();
		for (let i = 0; i < files.files.length; i++) {
			formData.append("file", files.files[i]);
		}

		fetch("/file/upload", {
			method: 'POST',
			body: formData,
		})
		.then((res) => res.text())
		.then((text) => {
			let response = JSON.parse(text);
			if (response.status == 1) {
				$.ajax({
					url: '/logs/import',
					method: 'post',
					dataType: 'json',
					data: {filename: response.filename},
					success: function(response) {
						if (response.status == 1) {
							document.getElementById("logs_import").reset();
							$("#import_logs_history button.close").trigger("click");
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: response.message,
								type: "success",
								timer: 1200
							});
						} else {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Error!",
								text: response.message,
								type: "error",
								timer: 3000
							});
						}
					},
					error: function(response) {
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({'display':'none'});
						console.log(response);
						alert('server error');
					}
				});
			} else {
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({'display':'none'});
				swal({
					title: "Error!",
					text: response.message,
					type: "error",
					timer: 3000
				});
			}
		})
		.catch((err) => {
			$('.overlay, body').addClass('loaded');
			$('.overlay').css({'display':'none'});
		});
	}

	getdata(parseInt(perPage), parseInt(currentPage));

	$('body').on('click', '#logs_data_table_paginate .paginate_button', function() {
		currentPage = $(this).attr('data-pageno');
		table.clear();
		table.destroy();
		table = $('#logs_data_table').DataTable({
			order: [[7, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: "full_numbers",
			aoColumns: [
				null,
				null,
				null,
				null,
				{ "sClass": "line-break-anywhare" },
				null,
				null,
				null,
				null,
				null,
				null
			]
		});

		getdata(parseInt(perPage), parseInt(currentPage));
	});

	$('body').on('change', '#logs_data_table_length select', function() {
		perPage = $('#logs_data_table_length select').val();
		currentPage = 1;
		table.clear();
		table.destroy();
		table = $('#logs_data_table').DataTable({
			order: [[7, 'desc']],
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: "full_numbers",
			aoColumns: [
				null,
				null,
				null,
				null,
				{ "sClass": "line-break-anywhare" },
				null,
				null,
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
		$('#logs_data_table tbody').html('<tr class="odd"><td valign="top" colspan="11" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

		$.ajax({
			url: '/logs/logGroupFullList',
			method: 'post',
			dataType: 'json',
			data: {page: parseInt(currentPage), limit: parseInt(perPage), type: 'log', searchItem: searchItem},
			success: function(response) {
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				let totalRecord = parseInt(response.total);

				if (response.data.length <= 0) {
					$('#logs_data_table tbody').html('<tr class="odd"><td valign="top" colspan="11" class="dataTables_empty">No data available in table</td></tr>');
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

					const endDateTime = (data?.last_end_log_history?.createdAt) ? data?.last_end_log_history?.createdAt : data?.last_log_history?.createdAt;
					const endDate = new Date(endDateTime);
					const endYear = endDate.getFullYear();
					const endMonth = endDate.getMonth() + 1;
					const endDay = endDate.getDate();
					const endHours = (endDate.getHours() < 10 ? '0' : '') + endDate.getHours();
					const endMinutes = (endDate.getMinutes() < 10 ? '0' : '') + endDate.getMinutes();
					const endSeconds = (endDate.getSeconds() < 10 ? '0' : '') + endDate.getSeconds();
					const endMilliseconds = (endDate.getMilliseconds() < 10 ? '00' : (endDate.getMilliseconds() < 100 ? '0' : '')) + endDate.getMilliseconds();
					const endTime = endYear + '-' + (endMonth < 10 ? '0' : '') + endMonth + '-' + (endDay < 10 ? '0' : '') + endDay + ' ' + endHours + ':' + endMinutes + ':' + endSeconds + '.' + endMilliseconds;

					const differenceInMilliseconds = new Date(endTime) - new Date(startTime);

					let $button_group = '<div class="btn-group" role="group" aria-label="Basic example">';
					$button_group += '<a href="' + data.unique_id + '" class="btn btn-secondary">View</a>';
					$button_group += '</div>';

					table.row.add([
						counter++,
						data?.item_details?.ItemName || "",
						data.unique_id,
						data.type,
						data.path,
						data?.last_end_log_history?.description || data?.last_log_history?.description,
						data?.last_end_log_history?.httpStatus || "",
						startTime,
						endTime,
						differenceInMilliseconds,
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
});
$(document).ready(function() {
	let perPage = 50;
	let currentPage = 1;
	let table = $('#project_data_table').DataTable({
		aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
		iDisplayLength: perPage,
		pagingType: "full_numbers",
	});

	getdata(parseInt(perPage), parseInt(currentPage));

	$('body').on('click', '#project_data_table_paginate .paginate_button', function() {
		currentPage = $(this).attr('data-pageno');
		table.clear();
		table.destroy();
		table = $('#project_data_table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: "full_numbers",
		});
		getdata(parseInt(perPage), parseInt(currentPage));
	});

	$('body').on('change', '#project_data_table_length select', function() {
		perPage = $('#project_data_table_length select').val();
		currentPage = 1;
		table.clear();
		table.destroy();
		table = $('#project_data_table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: "full_numbers",
		});
		getdata(parseInt(perPage), parseInt(currentPage));
	});

	function getdata(perPage, currentPage) {
		$('#project_data_table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

		$.ajax({
			url: '/projects/companyFullItemList',
			method: 'post',
			dataType: 'json',
			data: {page: parseInt(currentPage), limit: parseInt(perPage)},
			success: function(response) {
				const permissions = JSON.parse(decodeURIComponent(getCookie("permissions")));
				let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
				let totalRecord = parseInt(response.total);

				if (response.data === undefined || response.data.length <= 0) {
					$('#project_data_table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty">No data available in table</td></tr>');
				}

				$.each(response.data, function(index, data) {
					let last_run_inbound = '-';
					let last_run_inbound_date = '-';
					let last_run_outbound = '-';
					let last_run_outbound_date = '-';

					let $button_group = '<div class="btn-group" role="group" aria-label="Basic example">';
					if (permissions?.isAdmin || permissions?.canModifyItems) {
						$button_group += '<a href="project-edit/' + data._id + '" class="btn btn-secondary">Edit</a>';
					}

					if (data.inbound_setting != undefined && data.outbound_setting != undefined && (data.schedule_setting != undefined || data.inbound_setting.sync_type == 'API')) {
						if (data.isActive == 0) {
							$button_group += '<button type="button" data-value="1" data-id="' + data._id + '" class="btn btn-secondary waves-effect btn_is_active">Inactive</button>';
						} else {
							$button_group += '<button type="button" data-value="0" data-id="' + data._id + '" class="btn btn-outline-success waves-effect btn_is_active">Active</button>';
						}
					}

					if ((data.inbound_setting != undefined && data.schedule_setting != undefined && data.schedule_setting.Schedule_configure_inbound == 'click_by_user' && data.inbound_setting.sync_type == 'FTP') || (data.inbound_setting != undefined && data.schedule_setting != undefined && data.schedule_setting.Schedule_configure_inbound == 'click_by_user' && data.inbound_setting.sync_type == 'API' && data.inbound_setting.api_type == 'User_API')) {
						$button_group += '<button type="button" data-project-id="' + data._id + '" data-is-active="' + data.inbound_setting.is_active + '" class="btn btn-secondary waves-effect run_inbound">RunInbound</button>';
					}

					if (data.outbound_setting != undefined && data.schedule_setting != undefined && data.schedule_setting.Schedule_configure_outbound == 'click_by_user' && data.inbound_setting.sync_type != 'API') {
						$button_group += '<button type="button" data-project-id="' + data._id + '" data-is-active="' + data.outbound_setting.is_active + '" class="btn btn-secondary waves-effect run_outbound">RunOutbound</button>'
					}

					// $button_group += '<button type="button" class="btn btn-secondary waves-effect">View</button>';
					$button_group += '<a href="/logs/list?itemid=' + data._id + '" class="btn btn-outline-secondary waves-effect" data-toggle="tooltip" title="Schedule Logs"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-corner-up-right"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg></a>';
					$button_group += '</div>';

					if (data.inbound_history != undefined) {
						if (data.inbound_history.status == "success") {
							last_run_inbound = '<button type="button" class="btn btn-success round waves-effect">Success</button>';
						} else {
							last_run_inbound = '<button type="button" class="btn btn-danger round waves-effect">Fail</button>';
						}

						last_run_inbound_date = new Date(data.inbound_history.createdAt).toISOString().replace(/T/, ' ').replace(/\..+/, '');
					}

					if (data.outbound_history != undefined) {
						if (data.outbound_history.status == "success") {
							last_run_outbound = '<button type="button" class="btn btn-success round waves-effect">Success</button>';
						} else {
							last_run_outbound = '<button type="button" class="btn btn-danger round waves-effect">Fail</button>';
						}

						last_run_outbound_date = new Date(data.outbound_history.createdAt).toISOString().replace(/T/, ' ').replace(/\..+/, '');
					}

					var row = table.row.add([
						counter++,
						data.CompanyName,
						data.ItemCode,
						data.ItemName,
						last_run_inbound,
						last_run_inbound_date,
						last_run_outbound,
						last_run_outbound_date,
						$button_group
					])
					table.row(row).column(4).nodes().to$().addClass('text-center');
					table.row(row).column(6).nodes().to$().addClass('text-center');
					table.row(row).draw(false);

					if (data.isActive == 0) {
						$('#project_data_table tr').last().addClass('table-secondary');
					}
				});

				$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
				let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
				let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
				endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

				if (totalRecord == 0) {
					startEntry = 0;
				}

				let showpage = "Showing " + startEntry + " to " + endEntry + " of " + totalRecord + " entries";
				$('body').find('#project_data_table_info').html(showpage);

				let dataDtIdx = 0;
				let paginationHtml = '';
				let firstDisable = (parseInt(currentPage) == 1) ? "disabled" : "";
				let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? "disabled" : "";

				if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
					paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="project_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="project_data_table_first_1" data-pageno="1">First</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="project_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="project_data_table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
					paginationHtml += '<span>';
					dataDtIdx++;

					if (parseInt(currentPage) > 2) {
						paginationHtml += '<a class="paginate_button" aria-controls="project_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
						if (parseInt(currentPage) > 3) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						dataDtIdx++;
					}

					if ((parseInt(currentPage) - 1) > 0) {
						paginationHtml += '<a class="paginate_button" aria-controls="project_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '<a class="paginate_button current" aria-controls="project_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
					dataDtIdx++;

					if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
						paginationHtml += '<a class="paginate_button" aria-controls="project_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
						dataDtIdx++;
					}

					if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
						if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
							paginationHtml += '<span class="ellipsis">...</span>';
						}
						paginationHtml += '<a class="paginate_button" aria-controls="project_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
						dataDtIdx++;
					}

					paginationHtml += '</span>';
					paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="project_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="project_data_table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
					dataDtIdx++;
					paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="project_data_table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="project_data_table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
				}

				$('body').find('#project_data_table_paginate').html(paginationHtml);
			},
			error: function(response) {
				console.log(response);
				alert('server error');
			}
		});
	}

	$('body').on('click', '.run_inbound', function() {
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({'display':'block'});

		let item_id = $(this).data('project-id');
		let is_active = $(this).data('is-active');

		if (is_active == "Active") {
			$.ajax({
				url: '/inbound/inboundrun',
				method: 'post',
				dataType: 'json',
				data: {item_id: item_id},
				success: function(response) {
					if (response.status == 1) {
						swal({
							title: "Success!",
							text: response.message,
							type: "success",
							timer: 5000
						});
					} else {
						swal({
							title: "Fail!",
							text: response.message,
							type: "fail",
							timer: 5000
						});
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
				},
				timeout: 36000000
			})
		} else {
			$('.overlay, body').addClass('loaded');
			$('.overlay').css({'display':'none'});
			swal({
				title: "Fail!",
				text: "Inbound is Inactive",
				type: "fail",
				timer: 5000
			});
		}
	});

	$('body').on('click', '.run_outbound', function() {
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({'display':'block'});

		let item_id = $(this).data('project-id');
		let item_code = $(this).data('project-code');
		let is_active = $(this).data('is-active');

		if (is_active == "Active") {
			$.ajax({
				url: '/inbound/outboundrun',
				method: 'post',
				dataType: 'json', 
				data: {item_id: item_id, item_code: item_code},
				success: function(response) {
					if (response.status == 1) {
						swal({
							title: "Success!",
							text: response.message,
							type: "success",
							timer: 5000
						});
					} else {
						swal({
							title: "Fail!",
							text: response.message,
							type: "fail",
							timer: 5000
						});
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
				}
			});
		} else {
			$('.overlay, body').addClass('loaded');
			$('.overlay').css({'display':'none'});
			swal({
				title: "Fail!",
				text: "Outbound is Inactive",
				type: "fail",
				timer: 5000
			});
		}
	});

	$('body').on('click', '.btn_is_active', function() {
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({'display':'block'});

		let isActive = $(this).data('value');
		let item_id = $(this).data('id');
		let $this = $(this);

		$.ajax({
			url: '/projects/update/' + item_id,
			method: 'put',
			dataType: 'json',
			data: {isActive: isActive},
			success: function(response) {
				if (response.status == 1) {
					if (isActive == 1) {
						$this.data('value', '0');
						$this.html('Active');
						$this.removeClass('btn-secondary');
						$this.addClass('btn-outline-success');
						swal({
							title: "Success!",
							text: response.message,
							type: "success",
							timer: 1200
						});
						$this.parents('tr').removeClass('table-secondary');
					} else {
						$this.data('value', '1');
						$this.html('Inactive');
						$this.addClass('btn-secondary');
						$this.removeClass('btn-outline-success');
						swal({
							title: "Success!",
							text: response.message,
							type: "success",
							timer: 1200
						});
						$this.parents('tr').addClass('table-secondary');
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
				} else {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
					swal({
						title: "Error!",
						text: response.message,
						type: "error",
						timer: 1200
					});
				}
			}
		});
	});

	$('body').on('click', '#btn_create_new_project', function() {
		window.location.href = "/projects/add";
	});

	(function (window, document, $) {
		'use strict';
		// Default Spin
		$('.touchspin').TouchSpin({
			buttondown_class: 'btn btn-primary',
			buttonup_class: 'btn btn-primary',
			buttondown_txt: feather.icons['minus'].toSvg(),
			buttonup_txt: feather.icons['plus'].toSvg()
		});

		// Icon Change
		$('.touchspin-icon').TouchSpin({
			buttondown_txt: feather.icons['chevron-down'].toSvg(),
			buttonup_txt: feather.icons['chevron-up'].toSvg()
		});

		// Min - Max
		let touchspinValue = $('.touchspin-min-max'),
			counterMin = 17,
			counterMax = 21;
		if (touchspinValue.length > 0) {
			touchspinValue
			.TouchSpin({
				min: counterMin,
				max: counterMax,
				buttondown_txt: feather.icons['minus'].toSvg(),
				buttonup_txt: feather.icons['plus'].toSvg()
			})
			.on('touchspin.on.startdownspin', function () {
				let $this = $(this);
				$('.bootstrap-touchspin-up').removeClass('disabled-max-min');

				if ($this.val() == counterMin) {
					$(this).siblings().find('.bootstrap-touchspin-down').addClass('disabled-max-min');
				}
			})
			.on('touchspin.on.startupspin', function () {
				let $this = $(this);
				$('.bootstrap-touchspin-down').removeClass('disabled-max-min');

				if ($this.val() == counterMax) {
					$(this).siblings().find('.bootstrap-touchspin-up').addClass('disabled-max-min');
				}
			});
		}

		// Step
		$('.touchspin-step').TouchSpin({
			step: 5,
			buttondown_txt: feather.icons['minus'].toSvg(),
			buttonup_txt: feather.icons['plus'].toSvg()
		});

		// Color Options
		$('.touchspin-color').each(function (index) {
			let down = 'btn btn-primary',
				up = 'btn btn-primary',
				$this = $(this);

			if ($this.data('bts-button-down-class')) {
				down = $this.data('bts-button-down-class');
			}

			if ($this.data('bts-button-up-class')) {
				up = $this.data('bts-button-up-class');
			}

			$this.TouchSpin({
				mousewheel: false,
				buttondown_class: down,
				buttonup_class: up,
				buttondown_txt: feather.icons['minus'].toSvg(),
				buttonup_txt: feather.icons['plus'].toSvg()
			});
		});
	})(window, document, jQuery);
});
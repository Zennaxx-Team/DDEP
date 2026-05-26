let permissionCompanyCode = '';

$(document).ready(async function() {
	if ($('#permission-data-table').length) {
		toggleIconState('addIcon', true);
	} else {
		toggleIconState('saveIcon', true);
	}
	
	$('body').on('click', '.addIcon', function () {
		window.location.href = '/permissions/create';
	});
	
	if ($('#permission-data-table').length) {
		let perPage = 50;
		let currentPage = 1;
		let table = $('#permission-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: false
		});

		getPermissions(parseInt(perPage), parseInt(currentPage));

		$('body').on('click', '#permission-data-table_paginate .paginate_button', function() {
			currentPage = $(this).attr('data-pageno');
			table.clear();
			table.destroy();
			table = $('#permission-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getPermissions(parseInt(perPage), parseInt(currentPage));
		});

		$('body').on('change', '#permission-data-table_length select', function() {
			perPage = $('#permission-data-table_length select').val();
			currentPage = 1;
			table.clear();
			table.destroy();
			table = $('#permission-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: false
			});
			getPermissions(parseInt(perPage), parseInt(currentPage));
		});

		function getPermissions(perPage, currentPage) {
			$('#permission-data-table tbody').html('<tr class="odd"><td valign="top" colspan="8" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

			$.ajax({
				url: '/permissions/list',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({page: parseInt(currentPage), limit: parseInt(perPage)}),
				success: function(response) {
					let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
					let totalRecord = parseInt(response.total);

					if (response.data === undefined || response.data.length <= 0) {
						$('#permission-data-table tbody').html('<tr class="odd"><td valign="top" colspan="8" class="dataTables_empty">No data available in table</td></tr>');
					}

					$.each(response.data, function(index, data) {
						let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input is-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
						$switchActive += data.isActive ? 'checked ' : '';
						$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

						let $buttonGroup = '<div class="btn-group" role="group" aria-label="Basic example">';
						$buttonGroup += '<a href="#" class="btn btn-outline-secondary" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></a>';

						$buttonGroup += '<a href="permissions/edit/' + data._id + '" class="btn btn-outline-secondary" data-toggle="tooltip" title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></a>';
						$buttonGroup += '</div>';

						var row = table.row.add([
							counter++,
							data.name,
							data.description,
							data.createdBy,
							dateFormat(data.createdAt),
							dateFormat(data.updatedAt),
							$switchActive,
							$buttonGroup
						])

						table.row(row).draw(false);
					});

					$('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
					let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
					let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
					endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

					if (totalRecord == 0) {
						startEntry = 0;
					}

					let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
					$('body').find('#permission-data-table_info').html(showpage);

					let dataDtIdx = 0;
					let paginationHtml = '';
					let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
					let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

					if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
						paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="permission-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="permission-data-table_first_1" data-pageno="1">First</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="permission-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="permission-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
						paginationHtml += '<span>';
						dataDtIdx++;

						if (parseInt(currentPage) > 2) {
							paginationHtml += '<a class="paginate_button" aria-controls="permission-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
							if (parseInt(currentPage) > 3) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							dataDtIdx++;
						}

						if ((parseInt(currentPage) - 1) > 0) {
							paginationHtml += '<a class="paginate_button" aria-controls="permission-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '<a class="paginate_button current" aria-controls="permission-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
						dataDtIdx++;

						if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
							paginationHtml += '<a class="paginate_button" aria-controls="permission-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
							dataDtIdx++;
						}

						if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
							if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							paginationHtml += '<a class="paginate_button" aria-controls="permission-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '</span>';
						paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="permission-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="permission-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="permission-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="permission-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
					}

					$('body').find('#permission-data-table_paginate').html(paginationHtml);
				},
				error: function(xhr, status, error) {
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
				}
			});
		}
	}

	$('body').on('change', '.is-active-button', function() {
		$this = $(this);
		Swal.fire({
			title: 'Are you sure?',
			text: ($this.is(':checked')) ? `You want to active this permission?` : `You want to inactive this permission?`,
			icon: 'info',
			showCancelButton: true,
			confirmButtonText: 'Yes',
			customClass: {
				confirmButton: 'btn btn-primary',
				cancelButton: 'btn btn-outline-danger ml-1'
			},
			buttonsStyling: false
		}).then(function (result) {
			if (result.value) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				const isActive = ($this.is(':checked')) ? true : false;
				const permissionId = $this.data('id');

				$.ajax({
					url: '/permissions/status/' + permissionId,
					method: 'POST',
					contentType: 'application/json',
					data: JSON.stringify({isActive: isActive}),
					success: function(response) {
						if (response.status == 1) {
							Swal.fire({
								title: 'Success!',
								text: response.message,
								icon: 'success',
								customClass: {
									confirmButton: 'btn btn-primary'
								},
								buttonsStyling: false,
								timer: 1200
							});
						} else {
							Swal.fire({
								title: 'Error!',
								text: response.message,
								icon: 'error',
								customClass: {
									confirmButton: 'btn btn-primary'
								},
								buttonsStyling: false,
								timer: 1200
							});
						}

						$('.overlay, body').addClass('loaded');
						$('.overlay').css({'display':'none'});
					},
					error: function(xhr, status, error) {
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({'display':'none'});

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
		});
	});

	if ($('#form-permission-create').length) {
		formValidator = $('#form-permission-create').validate({
			rules: {
				'permission-name': {
					required: true
				}
			},
			messages: {
				'permission-name': {
					required: 'Please enter the Permission Name!'
				}
			},
			submitHandler: function(form) {
				handleFormSubmit();
			},
			errorPlacement: function(error, element) {
				clearErrorForElement(element);
				showError(element, error.text());
			}
		});

		function showError($input, message) {
			const errorElement = $('<div class="help-block animation-slideDown error"></div>');
			errorElement.text(message);
			$input.addClass('error');
			$input.closest('.form-group').append(errorElement);
		}

		function clearErrors() {
			$('.help-block').remove();
			$('.form-control').removeClass('error');
		}

		function clearErrorForElement(element) {
			const $input = $(element);
			$input.closest('.form-group').find('.help-block').remove();
			$input.removeClass('error');
		}

		function handleFormSubmit() {
			$('#form-permission-create').find('button[type="submit"]').prop('disabled', true);

			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({'display':'block'});
			let permissions = [];

			if (!$('#is-admin').is(':checked')) {
				permissions = [
					{
						type: 'projects',
						canView: $('#can-view-projects').is(':checked') ? 1 : 0,
						canCreate: $('#can-create-projects').is(':checked') ? 1 : 0,
						canModify: $('#can-modify-projects').is(':checked') ? 1 : 0
					},
					{
						type: 'items',
						canView: $('#can-view-items').is(':checked') ? 1 : 0,
						canCreate: $('#can-create-items').is(':checked') ? 1 : 0,
						canModify: $('#can-modify-items').is(':checked') ? 1 : 0
					},
				];
			}

			const data = {
				permissionName: $('#permission-name').val(),
				isAdmin: $('#is-admin').is(':checked') ? 1 : 0,
				permissionDescription: $('#permission-description').val(),
				isActive: $('#is-active').is(':checked') ? 1 : 0,
				permissions,
				companyCode: permissionCompanyCode
			};

			const id = $('#permission-id').val();
			const apiUrl = (!id) ? '/permissions/create' : '/permissions/update/' + id;
			const method = (!id) ? 'POST' : 'PUT';

			$.ajax({
				url: apiUrl,
				method: method,
				contentType: 'application/json',
				data: JSON.stringify(data),
				success: function(response) {
					if (response.status === 1) {
						Swal.fire({
							title: 'Success!',
							text: response.message,
							icon: 'success',
							customClass: {
								confirmButton: 'btn btn-primary'
							},
							buttonsStyling: false,
							timer: 1200
						});

						if (!id) window.location.href = '/permissions';
					} else {
						Swal.fire({
							title: 'Error!',
							text: response.message,
							icon: 'error',
							customClass: {
								confirmButton: 'btn btn-primary'
							},
							buttonsStyling: false,
							timer: 1200
						});
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
					$('#form-permission-create').find('button[type="submit"]').prop('disabled', false);
				},
				error: function(xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
					$('#form-permission-create').find('button[type="submit"]').prop('disabled', false);

					Swal.fire({
						title: 'Error!',
						text: xhr?.responseJSON?.message || 'An unexpected error occurred.',
						icon: 'error',
						customClass: {
							confirmButton: 'btn btn-primary'
						},
						buttonsStyling: false,
						timer: 1200
					});
				}
			});
		}

		await editPermission();
	}

	function editPermission() {
		const id = $('#permission-id').val();
		if (id) {
			$.ajax({
				url: '/permissions/get/' + id,
				method: 'GET',
				success: function(response) {
					if (response.status === 1) {
						const data = response?.data;

						$('#permission-name').val(data.name);
						$('#permission-description').val(data.description);

						permissionCompanyCode = data.companyCode;

						if (data.isActive) {
							$('#is-active').prop('checked', true);
						} else {
							$('#is-active').prop('checked', false);
						}

						if (data.isAdmin) {
							$('#is-admin').prop('checked', true);
						} else {
							$('#is-admin').prop('checked', false);
						}

						for (var i = 0; i < data.permissionsTypes.length; i++) {
							if (data.permissionsTypes[i].canView) {
								$('#can-view-' + data.permissionsTypes[i].type).prop('checked', true);
							}
							if (data.permissionsTypes[i].canCreate) {
								$('#can-create-' + data.permissionsTypes[i].type).prop('checked', true);
							}
							if (data.permissionsTypes[i].canModify) {
								$('#can-modify-' + data.permissionsTypes[i].type).prop('checked', true);
							}
						}
					} else {
						Swal.fire({
							title: 'Error!',
							text: response.message,
							icon: 'error',
							customClass: {
								confirmButton: 'btn btn-primary'
							},
							buttonsStyling: false,
							timer: 1200
						});
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
				},
				error: function(xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});

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
	}
});
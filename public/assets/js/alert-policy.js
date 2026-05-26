let companyCodePolicy = '';
let isMasterPageAlertPolicy = true;

$(document).ready(async function() {
	let policyId = '';

	if ($('#alert-policy-data-table').length) {
		toggleIconState('addIcon', true , "policy");
	}

	$('body').on('click', '.policy', function () {
		clearFormFields();
		$('#alert-policy-modal-slide-in').modal('show');
	});

	if ($('#alert-policy-data-table').length) {
		let perPage = 50,
		currentPage = 1,
		table = $('#alert-policy-data-table').DataTable({
			aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
			iDisplayLength: perPage,
			pagingType: 'full_numbers',
			searching: true,
			initComplete: function() {
				$('#alert-policy-data-table_filter input').unbind().bind('keyup', function(e) {
					if (e.keyCode === 13) {
						currentPage = 1; 
						getAlertPolicy(parseInt(perPage), parseInt(currentPage));
					}
				});
			}
		});

		getAlertPolicy(parseInt(perPage), parseInt(currentPage));

		$('body').on('click', '#alert-policy-data-table_paginate .paginate_button', function() {
			currentPage = $(this).attr('data-pageno');
			table.clear();
			table.destroy();
			table = $('#alert-policy-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: true,
			});
			getAlertPolicy(parseInt(perPage), parseInt(currentPage));
		});

		$('body').on('change', '#alert-policy-data-table_length select', function() {
			perPage = $('#alert-policy-data-table_length select').val();
			currentPage = 1;
			table.clear();
			table.destroy();
			table = $('#alert-policy-data-table').DataTable({
				aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
				iDisplayLength: perPage,
				pagingType: 'full_numbers',
				searching: true,
			});
			getAlertPolicy(parseInt(perPage), parseInt(currentPage));
		});

		function getAlertPolicy(perPage, currentPage) {
			$('#alert-policy-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

			$.ajax({
				url: '/alerts/alert-policies/list',
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify({page: parseInt(currentPage), limit: parseInt(perPage), search: $('#alert-policy-data-table_filter input').val()}),
				beforeSend: function() {
					table.clear().draw(); 
				},
				success: function(response) {
					let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
					let totalRecord = parseInt(response.total);

					if (response.data === undefined || response.data.length <= 0) {
						$('#alert-policy-data-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty">No data available in table</td></tr>');
					}

					$.each(response.data, function(index, data) {
						let $switchActive = '<div class="demo-inline-spacing"><div class="custom-control custom-switch custom-control-inline"><input type="checkbox" class="custom-control-input is-alert-policy-active-button" id="custom-switch-' + index + '" data-id="' + data._id + '"';
						$switchActive += data.isActive ? 'checked ' : '';
						$switchActive += '/><label class="custom-control-label" for="custom-switch-' + index + '"></label></div></div>';

						let $buttonGroup = '<div class="btn-group" role="group" aria-label="Basic example">';
						$buttonGroup += '<a href="#" class="btn btn-outline-secondary" data-toggle="tooltip" title="Clone"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></a>';

						$buttonGroup += '<button type="button" class="btn btn-outline-secondary alert-policy-model" data-toggle="tooltip" title="View" data-id="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>';

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
					$('body').find('#alert-policy-data-table_info').html(showpage);

					let dataDtIdx = 0;
					let paginationHtml = '';
					let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
					let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

					if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
						paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="alert-policy-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-policy-data-table_first_1" data-pageno="1">First</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="alert-policy-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-policy-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
						paginationHtml += '<span>';
						dataDtIdx++;

						if (parseInt(currentPage) > 2) {
							paginationHtml += '<a class="paginate_button" aria-controls="alert-policy-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
							if (parseInt(currentPage) > 3) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							dataDtIdx++;
						}

						if ((parseInt(currentPage) - 1) > 0) {
							paginationHtml += '<a class="paginate_button" aria-controls="alert-policy-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '<a class="paginate_button current" aria-controls="alert-policy-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
						dataDtIdx++;

						if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
							paginationHtml += '<a class="paginate_button" aria-controls="alert-policy-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
							dataDtIdx++;
						}

						if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
							if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
								paginationHtml += '<span class="ellipsis">...</span>';
							}
							paginationHtml += '<a class="paginate_button" aria-controls="alert-policy-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
							dataDtIdx++;
						}

						paginationHtml += '</span>';
						paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="alert-policy-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-policy-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
						dataDtIdx++;
						paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="alert-policy-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-policy-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
					}

					$('body').find('#alert-policy-data-table_paginate').html(paginationHtml);
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

	$('body').on('change', '.is-alert-policy-active-button', function() {
		$this = $(this);
		Swal.fire({
			title: 'Are you sure?',
			text: ($this.is(':checked')) ? `You want to active this alert policy?` : `You want to inactive this alert policy?`,
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
				const alertPolicyId = $this.data('id');

				$.ajax({
					url: '/alerts/alert-policies/status/' + alertPolicyId,
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
	
	$('body').on('click', 'button.alert-policy-model', function () {
		clearFormFields();
		policyId = $(this).attr('data-id');
		if (policyId) {
			$('#policy-id').val(policyId);
			$('#alert-modal-label').text('Update Alert Policy');
			$('#create-alert-policy').text('Update Alert Policy');
			editAlertPolicy(policyId);
		}
		$('#alert-policy-modal-slide-in').modal('show');
	});

	if ($('#form-policy-create').length) {
		formValidator = $('#form-policy-create').validate({
			rules: {
				'policy-name': {
					required: true
				}
			},
			messages: {
				'policy-name': {
					required: 'Please enter the Policy Name!'
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
			$('#form-policy-create').find('button[type="submit"]').prop('disabled', true);

			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({'display':'block'});

			const data = {
				name: $('#policy-name').val(),
				description: $('#policy-description').val(),
				isActive: $('#is-active').is(':checked') ? 1 : 0,
				companyCode: companyCodePolicy
			};

			const id = $('#policy-id').val();
			const apiUrl = (!id) ? '/alerts/alert-policies/create' : '/alerts/alert-policies/update/' + id;
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

						if (!isMasterPageAlertPolicy) {
							updatePolicyOptions();
						} else {
							window.location.reload();
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
					$('#form-policy-create').find('button[type="submit"]').prop('disabled', false);
				},
				error: function(xhr, status, error) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
					$('#form-policy-create').find('button[type="submit"]').prop('disabled', false);

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

		await editAlertPolicy();
	}

	function editAlertPolicy() {
		const id = $('#policy-id').val();
		if (id) {
			$.ajax({
				url: '/alerts/alert-policies/get/' + id,
				method: 'GET',
				success: function(response) {
					if (response.status === 1) {
						const data = response?.data;

						$('#policy-name').val(data.name);
						$('#policy-description').val(data.description);

						if (data.isActive) {
							$('#is-active').prop('checked', true);
						} else {
							$('#is-active').prop('checked', false);
						}

						companyCodePolicy = data.companyCode;
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

	function clearFormFields() {
		clearErrors();
		$('#form-policy-create')[0].reset();
		$('#policy-id').val('');
		$('#alert-modal-label').text('Create Alert Policy');
		$('#create-alert-policy').text('Create Alert Policy');
		$('#is-active').prop('checked', true);
	}
});
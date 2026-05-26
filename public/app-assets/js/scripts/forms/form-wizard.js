$(document).ready(function () {
	'use strict';

	var bsStepper = document.querySelectorAll('.bs-stepper'),
	select = $('.select2.custom-select'),
	horizontalWizard = document.querySelector('.horizontal-wizard-example'),
	verticalWizard = document.querySelector('.vertical-wizard-example'),
	modernWizard = document.querySelector('.modern-wizard-example'),
	modernVerticalWizard = document.querySelector('.modern-vertical-wizard-example');

	const milliseconds = (h, m, s) => ((h * 60 * 60 + m * 60 + s) * 1000);
	var inbound_start_date;
	var inbound_end_date;
	var outbound_start_date;
	var outbound_end_date;
	var item_detail = {};
	var inbound_server_detail = {};
	var outbound_detail = {};
	var schedule_detail = {};
	var validationRowCounter = 1;
	var inboundFilterCounter = 1;
	var outboundFilterCounter = 1;
	var inOutAutocompleteDataArray = [];
	var inboundAutocompleteDataArray = [];
	var outboundAutocompleteDataArray = [];
	var inOutAutocompleteDataArrayOutbound = [];
	var inboundAutocompleteDataArrayOutbound = [];
	var outboundAutocompleteDataArrayOutbound = [];
	var authorizationApiKeyArray = [];
	var outboundGlobalHeadersRowCounter = 1;
	var outboundSpecifyHeadersRowCounter = 1;
	var outboundSpecifyHeadersObj = {};

	$('#weekly_fields').hide();
	$('#weekly_fields_outbound').hide();
	$('#monthly_fields').hide();
	$('#monthly_fields_outbound').hide();
	$('#the_section').hide();
	$('#the_section_outbound').hide();

	if (typeof bsStepper !== undefined && bsStepper !== null) {
		for (var el = 0; el < bsStepper.length; ++el) {
			bsStepper[el].addEventListener('show.bs-stepper', function (event) {
				var index = event.detail.indexStep;
				var numberOfSteps = $(event.target).find('.step').length - 1;
				var line = $(event.target).find('.step');

				for (var i = 0; i < index; i++) {
					line[i].classList.add('crossed');

					for (var j = index; j < numberOfSteps; j++) {
						line[j].classList.remove('crossed');
					}
				}
				if (event.detail.to == 0) {
					for (var k = index; k < numberOfSteps; k++) {
						line[k].classList.remove('crossed');
					}
					line[0].classList.remove('crossed');
				}
			});
		}
	}

	select.each(function () {
		var $this = $(this);
		$this.wrap('<div class="position-relative"></div>');
		$this.select2({
			placeholder: 'Select value',
			dropdownParent: $this.parent()
		});
	});

	// Horizontal Wizard
	// --------------------------------------------------------------------
	if (typeof horizontalWizard !== undefined && horizontalWizard !== null) {
		var numberedStepper = new Stepper(horizontalWizard),
		$form = $(horizontalWizard).find('form');
		$.validator.addMethod(
			"regex",
			function(value, element, regexp) {
				var re = new RegExp(regexp);
				return this.optional(element) || re.test(value);
			},
			"DDEP API is not valid (must start with a '/' and must contain any letter, capitalize letter, number, dash or underscore)"
		);

		$.validator.addMethod(
			"pattern",
			function(value, element, regexp) {
				if ((value.match(/\//g) || []).length > regexp) {
					return false;
				} else {
					return true;
				}
			},
			"DDEP API is only allow 10 '/'"
		);

		$form.each(function() {
			var $this = $(this);
			$this.validate({
				rules: {
					ItemCode: {
						required: true,
						remote: {
							type: 'POST',
							url: "/projects/checkcodeexist",
							data: {
								ItemCode: function() {return $("#ItemCode").val();},
								Item_id: function() {return $("#Item_id").val();},
							},
						}
					},
					ItemName: {
						required: true,
					},
					CompanyName: {
						required: true
					},
					sync_type: {
						required: true
					},
					ftp_server_link: {
						required: true
					},
					port: {
						required: true
					},
					login_name: {
						required: true
					},
					password: {
						required: true
					},
					folderpath: {
						required: true
					},
					api_url: {
						required: true,
					},
					Schedule_configure: {
						required: true
					},
					schedule_type: {
						required: true
					},
					inbound_format: {
						required: true
					},
					recurs_count_inbound: {
						required: true,
						min: 1,
						digits: true
					},
					recurs_time: {
						required: true
					},
					api_type: {
						required: true
					},
					api_user_api: {
						required: true
					},
					api_ddep_api: {
						required: true,
						maxlength: 100,
						regex: /^(\/)[a-zA-Z0-9-_\/]+$/,
						pattern: 10,
						remote: {
							type: 'POST',
							url: "/inbound_setting/checkddepinputexist",
							data: {
								api_ddep_api: function() {return $("#api_ddep_api").val();},
								item_id: function() {return $("#Item_id").val();},
							},
						}
					},
					api_ddep_api_receive_parameter_name: {
						required: true
					},
					one_time_occurrence_inbound_date: {
						required: "#one_time_occurrence_inbound_date:visible"
					},
					one_time_occurrence_inbound_time: {
						required: "#one_time_occurrence_inbound_time:visible"
					},
					one_time_occurrence_outbound_date: {
						required: "#one_time_occurrence_outbound_date:visible"
					},
					one_time_occurrence_outbound_time: {
						required: "#one_time_occurrence_outbound_time:visible"
					},
					daily_frequency_once_time_inbound: {
						required: "#daily_frequency_once_time_inbound:visible"
					},
					daily_frequency_once_time_outbound: {
						required: "#daily_frequency_once_time_outbound:visible"
					},
					duration_inbound_start_date: {
						required: '#duration_inbound_start_date:visible'
					},
					duration_outbound_start_date: {
						required: '#duration_outbound_start_date:visible'
					},
					daily_frequency_every_time_count_start_inbound: {
						required: '#daily_frequency_every_time_count_start_inbound:visible'
					},
					daily_frequency_every_time_count_start_outbound: {
						required: '#daily_frequency_every_time_count_start_outbound:visible'
					},
					daily_frequency_every_time_count_end_inbound: {
						required: "#daily_frequency_every_time_count_end_inbound:visible"
					},
					daily_frequency_every_time_count_end_outbound: {
						required: "#daily_frequency_every_time_count_end_outbound:visible"
					},
					duration_inbound_end_date: {
						required: '#duration_inbound_end_date:visible'
					},
					duration_outbound_end_date: {
						required: "#duration_outbound_end_date:visible"
					},
				},
				messages : {
					ItemCode: {
						required: "Code Is Required",
						remote: "Code already exists."
					},
					api_ddep_api: {
						remote: "DDEP API input already exists."
					}
				}
			});
		});

		$(horizontalWizard)
		.find('.btn-next')
		.each(function(index) {
			$(this).on('click', function (e) {
				var $e = e;
				var isValid = $(this).parent().siblings('form').valid();
				var $thisform = $(this).parent().siblings('form');
				var item_id = $('#Item_id').val();

				if (isValid) {
					if (index == 0) {
						$('.overlay, body').removeClass('loaded');
						$('.overlay').css({'display':'block'});

						item_detail.ItemCode = $('#ItemCode').val();
						item_detail.ItemName = $('#ItemName').val();
						item_detail.CompanyName = $('#CompanyName').val();

						if (item_id == "") {
							$.ajax({
								url: '/projects/save',
								method: 'post',
								dataType: 'json',
								data: {ItemName: item_detail.ItemName, ItemCode: item_detail.ItemCode, CompanyName: item_detail.CompanyName},
								success: function(response) {
									$('#Item_id').val(response.id);
									$('.overlay, body').addClass('loaded');
									$('.overlay').css({'display':'none'});
									swal({
										title: "Success!",
										text: "Setting Saved Successfully",
										type: "success",
										timer: 1200
									});
									numberedStepper.to(2);
								},
								error: function(textStatus, error) {
									if (textStatus.responseJSON.status == 404) {
										window.location.href = "/404";
									} else {
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Error!",
											text: textStatus.responseJSON.message,
											type: "error",
											timer: 1200
										});
										return false;
									}
								}
							});
						} else {
							$.ajax({
								url: '/projects/project-update/' + item_id,
								method: 'put',
								dataType: 'json',
								data: {ItemName: item_detail.ItemName, ItemCode: item_detail.ItemCode, CompanyName: item_detail.CompanyName, companyCode: dataCompanyCode},
								success: function(response) {
									$('.overlay, body').addClass('loaded');
									$('.overlay').css({'display':'none'});
									swal({
										title: "Success!",
										text: "Setting Saved Successfully",
										type: "success",
										timer: 1200
									});
									numberedStepper.to(2);
								},
								error: function(textStatus, error) {
									if (textStatus.responseJSON.status == 404) {
										window.location.href = "/404";
									} else {
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Error!",
											text: textStatus.responseJSON.message,
											type: "error",
											timer: 1200
										});
										return false;
									}
								}
							});
						}
					} else if (index == 1) {
						var check = $(this).parent().siblings('form').valid();
						if (check) {
							$('.overlay, body').removeClass('loaded');
							$('.overlay').css({'display':'block'});

							var item_id = $('#Item_id').val();
							var inbound_setting_id = $("#inbound_setting_id").val();
							var inbound_format = $('#inboundFormat').val();
							var sync_type = $('input[name="sync_type"]:checked').val();
							var ftp_server_link = $('#ftp_server_link').val();
							var port = $('#port').val();
							var login_name = $('#login_name').val();
							var password = $('#password').val();
							var folder = $('#folderpath').val();
							var backup_folder = $('#backup_folder').val();
							var is_password_encrypted = $('#is_password_encrypted').val();
							var is_active = $('#is_active_inbound').attr('data-value');
							var api_ddep_api = $('#api_ddep_api').val() == undefined ? "" : $('#api_ddep_api').val();
							var api_user_api = $('#api_user_api').val() == undefined ? "" : $('#api_user_api').val();
							var api_ddep_api_receive_parameter_name = $('#api_ddep_api_receive_parameter_name').val();
							var api_type = $('input[name="api_type"]:checked').val();
							var ddep_api_auth_type = $('#ddep_api_auth_type').val();
							var ddep_api_authorization_api_keys = authorizationApiKeyArray;
							var max_file_download = $('#max_file_download').val();
							var max_file_download_val = (max_file_download == '') ? 0 : max_file_download;
							var enableLog = $('input[name="inboundEnableLogs"]:checked').val();

							if (sync_type == "API" && api_type == 'DDEP_API') {
								$('#inbound_shedule_setting_tab').hide();
								$('#outbound_shedule_setting_tab').hide();
								$('#inbound_ddep_api_selected').show();
								$('#outboud_max_post_file').hide();
								$('#collections_configure').show();
							}

							if (sync_type == "API" && api_type == 'User_API') {
								$('#inbound_shedule_setting_tab').show();
								$('#outbound_shedule_setting_tab').hide();
								$('#inbound_ddep_api_selected').hide();
								$('#outboud_max_post_file').hide();
								$('#collections_configure').show();
							}

							if (sync_type == "FTP" || sync_type == "SFTP") {
								$('#inbound_shedule_setting_tab').show();
								$('#outbound_shedule_setting_tab').show();
								$('#inbound_ddep_api_selected').hide();
								$('#outboud_max_post_file').show();
								$('#collections_configure').hide();
							}

							if (inbound_setting_id == "") {
								$.ajax({
									url: '/inbound_setting/save',
									method: 'post',
									dataType: 'json',
									data: {item_id: item_id, inbound_format: inbound_format, sync_type: sync_type, ftp_server_link: ftp_server_link, port: port, login_name: login_name, password: password, is_password_encrypted: is_password_encrypted, folder: folder, backup_folder: backup_folder, api_ddep_api: api_ddep_api, api_user_api: api_user_api, api_type: api_type, is_active: is_active, api_ddep_api_receive_parameter_name: api_ddep_api_receive_parameter_name, ddep_api_auth_type: ddep_api_auth_type, ddep_api_authorization_api_keys: ddep_api_authorization_api_keys, max_file_download: max_file_download_val, enableLog: enableLog},
									success: function(response) {
										$("#inbound_setting_id").val(response.id);
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Inbound Setting Saved Successfully",
											type: "success",
											timer: 1200
										});
										numberedStepper.to(3);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							} else {
								$.ajax({
									url: '/inbound_setting/update/' + inbound_setting_id,
									method: 'put',
									dataType: 'json',
									data: {item_id: item_id, inbound_format: inbound_format, sync_type: sync_type, ftp_server_link: ftp_server_link, port: port, login_name: login_name, password: password, is_password_encrypted: is_password_encrypted, folder: folder, backup_folder: backup_folder, api_ddep_api: api_ddep_api, api_user_api: api_user_api, api_type: api_type, is_active: is_active, api_ddep_api_receive_parameter_name: api_ddep_api_receive_parameter_name, ddep_api_auth_type: ddep_api_auth_type, ddep_api_authorization_api_keys: ddep_api_authorization_api_keys, max_file_download: max_file_download_val, companyCode: dataCompanyCode, enableLog: enableLog},
									success: function(response) {
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Inbound Setting Saved Successfully",
											type: "success",
											timer: 1200
										});
										numberedStepper.to(3);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							}
						} else {
							alert("not valid");
						}
					} else if (index == 2) {
						var check = $(this).parent().siblings('form').valid();
						if (check) {
							$('.overlay, body').removeClass('loaded');
							$('.overlay').css({'display':'block'});

							var item_id = $('#Item_id').val();
							var inbound_filter_id = $("#inbound_filter_id").val();
							var is_active = $('#is_active_inbound_filter').attr('data-value');

							var inboundFilters = [];
							$("#inbound-filter-table").find('tbody tr').each(function (i) {
								var inboundFilter = {};
								var $fieldset = $(this);
								inboundFilter.logical = $('select:eq(0) option:selected', $fieldset).val();
								inboundFilter.original = $('input:text:eq(0)', $fieldset).val();
								inboundFilter.operations = $('select:eq(1) option:selected', $fieldset).val();
								inboundFilter.column = $('input:text:eq(1)', $fieldset).val();
								inboundFilters.push(inboundFilter);
							});

							var inbound_filter = inboundFilters;
							var enableLog = $('input[name="inboundFilterEnableLogs"]:checked').val();

							if (inbound_filter_id == "") {
								$.ajax({
									url: '/project/item/filter/inbound/save',
									method: 'post',
									dataType: 'json',
									data: {item_id: item_id, inbound_filter: inbound_filter, is_active: is_active, enableLog: enableLog},
									success: function(response) {
										$("#inbound_filter_id").val(response.id);
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Inbound Filter Saved Successfully",
											type: "success",
											timer: 1200
										});
										numberedStepper.to(4);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							} else {
								$.ajax({
									url: '/project/item/filter/inbound/updateByItemId/' + item_id,
									method: 'put',
									dataType: 'json',
									data: {item_id: item_id, inbound_filter: inbound_filter, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
									success: function (response) {
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Inbound Filter Saved Successfully",
											type: "success",
											timer: 1200
										});
										numberedStepper.to(4);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							}
						} else {
							alert("not valid");
						}
					} else if (index == 3) {
						var check = $(this).parent().siblings('form').valid();
						if (check) {
							$('.overlay, body').removeClass('loaded');
							$('.overlay').css({'display':'block'});

							var item_id = $('#Item_id').val();
							var outbound_setting_id = $('#outbound_setting_id').val();
							var is_active = $('#is_active_outbound').attr('data-value');
							var sync_type_out = $('input[name="sync_type_out"]:checked').val();
							var api_url = $('#api_url').val();
							var outbound_format = $('#outbound_format').val();
							var max_file_post = $('#max_file_post').val();
							var max_file_post_val = (max_file_post == '') ? 0 : max_file_post;
							var sendCollectionOnebyOne = $('input[name="sendCollectionOnebyOne"]:checked').val();
							var collections_name = $('#collections_name').val();
							var enableLog = $('input[name="outboundEnableLogs"]:checked').val();
							var specifyHeadersObj = (Object.keys(outboundSpecifyHeadersObj).length === 0) ? "" : outboundSpecifyHeadersObj
							var globalHeadersDataArr = [];

							$("#outbound-global-headers-table").find('tbody tr').each(function () {
								var globalHeadersDataObj = {};
								var $fieldset = $(this);
								if ($('input:text:eq(0)', $fieldset).val() && $('input:text:eq(1)', $fieldset).val()) {
									var isChecked = $('input:checkbox:eq(0)', $fieldset).is(":checked") ? "true" : "false";
									globalHeadersDataObj.status = isChecked;
									globalHeadersDataObj.key = $('input:text:eq(0)', $fieldset).val();
									globalHeadersDataObj.value = $('input:text:eq(1)', $fieldset).val();
									globalHeadersDataObj.description = $('input:text:eq(2)', $fieldset).val();

									globalHeadersDataArr.push(globalHeadersDataObj);
								}
							});

							if (globalHeadersDataArr.length <= 0) {
								globalHeadersDataArr = "";
							}

							if (outbound_setting_id == "") {
								$.ajax({
									url: '/outbound_setting/save',
									method: 'post',
									dataType: 'json',
									data: {item_id: item_id, sync_type_out: sync_type_out, api_url: api_url, outbound_format: outbound_format, is_active: is_active, max_file_post: max_file_post_val, enableLog: enableLog, sendCollectionOnebyOne: sendCollectionOnebyOne, collections_name: collections_name, globalHeaders: globalHeadersDataArr, specifyHeaders: specifyHeadersObj},
									success: function(response) {
										$("#outbound_setting_id").val(response.id);
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Outbound Setting Saved Successfully",
											type: "success",
											timer: 1200
										});
										numberedStepper.to(5);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							} else {
								$.ajax({
									url: '/outbound_setting/update/' + outbound_setting_id,
									method: 'put',
									dataType: 'json',
									data: {item_id: item_id, sync_type_out: sync_type_out, api_url: api_url, outbound_format: outbound_format, is_active: is_active, max_file_post: max_file_post_val, companyCode: dataCompanyCode, enableLog: enableLog, sendCollectionOnebyOne: sendCollectionOnebyOne, collections_name: collections_name, globalHeaders: globalHeadersDataArr, specifyHeaders: specifyHeadersObj},
									success: function(response) {
										$("#outbound_setting_id").val(outbound_setting_id);
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Outbound Setting Saved Successfully",
											type: "success",
											timer: 1200
										});
										numberedStepper.to(5);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							}
						} else {
							alert("not valid");
						}
					} else if (index == 4) {
						var check = $(this).parent().siblings('form').valid();
						if (check) {
							$('.overlay, body').removeClass('loaded');
							$('.overlay').css({'display':'block'});

							var item_id = $('#Item_id').val();
							var mapping_setting_id = $("#mapping_setting_id").val();
							var inbound_format = $("#InboundFormatData").val();
							var outbound_format = $('#OutboundFormatData').val();
							var mapping_data = $('#mySavedModel2').val();
							var is_active = $('#is_active_mapping').attr('data-value');
							var inbound_data_format = $("#inboundFormat").val();
							var enableLog = $('input[name="inboundMappingEnableLogs"]:checked').val();

							if (inbound_format != "") {
								var isJson = IsJsonString(inbound_format);
								if (inbound_data_format == 'json' && !isJson) {
									alert("Please fill in a correct inbound format JSON");
									return false;
								}

								if (inbound_data_format == 'xml' && isJson) {
									alert("Please fill in a correct inbound format XML");
									return false;
								}
							}

							if (outbound_format != "") {
								var outbound_data_format = $('#outbound_format').val();
								var isJson = IsJsonString(outbound_format);
								if (outbound_data_format == 'json' && !isJson) {
									alert("Please fill in a correct outbound format JSON");
									return false;
								}

								if (outbound_data_format == 'xml' && isJson) {
									alert("Please fill in a correct outbound format XML");
									return false;
								}
							}

							if (inbound_format == '' && outbound_format == '') {
								$('#InboundFormatData').val('');
								$('#OutboundFormatData').val('');
								$('#mySavedModel').val('');
								mapping_data = '';
								nodeDataArray = [];
								linkDataArray = [];
								myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
							}

							if (mapping_setting_id == "") {
								$.ajax({
									url: '/project/item/mapping/save',
									method: 'post',
									dataType: 'json',
									data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog},
									success: function(response) {
										$("#mapping_setting_id").val(response.id);
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Mapping Setting Saved Successfully",
											type: "success",
											timer: 1200
										});

										if (inbound_format != '') {
											var inboundAutocompleteDataArrayReturn = inboundautocompletedata(inbound_format, "inbound");
										}

										if (outbound_format != '') {
											var outboundAutocompleteDataArrayReturn = outboundautocompletedata(outbound_format, "inbound");
										}

										inOutAutocompleteDataArray = inboundAutocompleteDataArray.concat(outboundAutocompleteDataArray);
										numberedStepper.to(6);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							} else {
								$.ajax({
									url: '/project/item/mapping/updateByItemId/' + item_id,
									method: 'put',
									dataType: 'json',
									data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
									success: function (response) {
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Mapping Setting Saved Successfully",
											type: "success",
											timer: 1200
										});

										if (inbound_format != '') {
											var inboundAutocompleteDataArrayReturn = inboundautocompletedata(inbound_format, "inbound");
										}

										if (outbound_format != '') {
											var outboundAutocompleteDataArrayReturn = outboundautocompletedata(outbound_format, "inbound");
										}

										inOutAutocompleteDataArray = inboundAutocompleteDataArray.concat(outboundAutocompleteDataArray);
										numberedStepper.to(6);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							}

							var props_setting_id = $("#props_setting_id").val();
							if (currentItemPropertyEnable == 1) {
								var itemProperty = {},
									display = {},
									validation = {},
									format = {},
									itemPropertyKey = '';

								itemProperty = currentItemProperty;

								display.value = $('#mapping-formula-props #props-display-value').val();
								display.defaultValue = $('#mapping-formula-props #props-display-default-value').val();
								itemProperty["display"] = display;

								validation.isRequired = $("#mapping-formula-props #props-validation-is-required option:selected").val();
								validation.valueMustbe = $("#mapping-formula-props #props-validation-value-must-be option:selected").val();

								var validationAdditonalRules = [];
								$("#prop-validation-additional-rules-table").find('tbody tr').each(function (i) {
									var validationAdditonalRule = {};
									var $fieldset = $(this);
									validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
									validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
									validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
									validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
									validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
									validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();
									validationAdditonalRules.push(validationAdditonalRule);
								});
								validation.additonal_rules = validationAdditonalRules;
								itemProperty["validation"] = validation;

								format.trim = $("#mapping-formula-props #props-format-is-trim option:selected").val();
								format.enableRounding = $("#mapping-formula-props #props-format-enable-rounding option:selected").val();
								format.enabeDecimal = $("#mapping-formula-props #props-format-enable-decimal option:selected").val();
								format.decimal = $('#mapping-formula-props #props-format-decimal').val();

								var formatAdditonalRules = [];
								$("#prop-format-additional-rules-table").find('tbody tr').each(function (i) {
									var formatAdditonalRule = {};
									var $fieldset = $(this);
									formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();

									if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
										formatAdditonalRule.formulato = $('select:eq(1) option:selected', $fieldset).val();
									} else {
										formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
									}

									if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING') {
										formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
									} else {
										formatAdditonalRule.formulatonew = '';
									}

									formatAdditonalRules.push(formatAdditonalRule);
								});
								format.additonal_rules = formatAdditonalRules;
								itemProperty["format"] = format;

								itemPropertyKey = itemProperty.general.itemKey;

								if (itemProperties.length > 0) {
									for (var i = 0; i < itemProperties.length; i++) {
										if (itemProperties[i].general.itemKey == itemPropertyKey) {
											itemProperties[i] = itemProperty;
											itemPropertyKey = '';
										}
									}
								}

								if (itemPropertyKey != "") {
									itemProperties.push(itemProperty);
								}
							}

							if (props_setting_id == "") {
								$.ajax({
									url: '/project/item/properties/save',
									method: 'post',
									dataType: 'json',
									data: {item_id: item_id, item_properties: itemProperties},
									success: function(response) {
										$("#props_setting_id").val(response.id);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							} else {
								$.ajax({
									url: '/project/item/properties/updateByItemId/' + item_id,
									method: 'put',
									dataType: 'json',
									data: {item_id: item_id, item_properties: itemProperties, companyCode: dataCompanyCode},
									success: function(response) {
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							}
						} else {
							alert("not valid");
						}
					} else if (index == 5) {
						var check = $(this).parent().siblings('form').valid();
						if (check) {
							$('.overlay, body').removeClass('loaded');
							$('.overlay').css({'display':'block'});

							var item_id = $('#Item_id').val();
							var outbound_filter_id = $("#outbound_filter_id").val();
							var is_active = $('#is_active_outbound_filter').attr('data-value');

							var outboundFilters = [];
							$("#outbound-filter-table").find('tbody tr').each(function (i) {
								var outboundFilter = {};
								var $fieldset = $(this);
								outboundFilter.logical = $('select:eq(0) option:selected', $fieldset).val();
								outboundFilter.original = $('input:text:eq(0)', $fieldset).val();
								outboundFilter.operations = $('select:eq(1) option:selected', $fieldset).val();
								outboundFilter.column = $('input:text:eq(1)', $fieldset).val();
								outboundFilters.push(outboundFilter);
							});

							var outbound_filter = outboundFilters;
							var enableLog = $('input[name="outboundFilterEnableLogs"]:checked').val();

							if (outbound_filter_id == "") {
								$.ajax({
									url: '/project/item/filter/outbound/save',
									method: 'post',
									dataType: 'json',
									data: {item_id: item_id, outbound_filter: outbound_filter, is_active: is_active, enableLog: enableLog},
									success: function(response) {
										$("#outbound_filter_id").val(response.id);
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Outbound Filter Saved Successfully",
											type: "success",
											timer: 1200
										});
										numberedStepper.to(7);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							} else {
								$.ajax({
									url: '/project/item/filter/outbound/updateByItemId/' + item_id,
									method: 'put',
									dataType: 'json',
									data: {item_id: item_id, outbound_filter: outbound_filter, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
									success: function (response) {
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});
										swal({
											title: "Success!",
											text: "Outbound Filter Saved Successfully",
											type: "success",
											timer: 1200
										});
										numberedStepper.to(7);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							}
						} else {
							alert("not valid");
						}
					} else if (index == 6) {
						var check = $(this).parent().siblings('form').valid();
						if (check) {
							$('.overlay, body').removeClass('loaded');
							$('.overlay').css({'display':'block'});

							var item_id = $('#Item_id').val();
							var mapping_setting_id = $("#outbound_mapping_setting_id").val();
							var inbound_format = $("#InboundFormatData_outbound").val();
							var outbound_format = $('#OutboundFormatData_outbound').val();
							var mapping_data = $('#outboundmySavedModel2').val();
							var is_active = $('#is_active_outbound_mapping').attr('data-value');
							var inbound_data_format = $("#inboundFormat").val();
							var outbound_data_format = $('#outbound_format').val();
							var enableLog = $('input[name="outboundMappingEnableLogs"]:checked').val();

							if (inbound_format != "") {
								var isJson = IsJsonString(inbound_format);
								if (outbound_data_format == 'json' && !isJson) {
									alert("Please fill in a correct outbound format JSON");
									return false;
								}

								if (outbound_data_format == 'xml' && isJson) {
									alert("Please fill in a correct outbound format XML");
									return false;
								}
							}

							if (inbound_format == '' && outbound_format == '') {
								$('#InboundFormatData_outbound').val('');
								$('#OutboundFormatData_outbound').val('');
								$('#outboundmySavedModel').val('');
								mapping_data = '';
								nodeDataArray = [];
								linkDataArray = [];
								outboundmyDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
							}

							if (mapping_setting_id == "") {
								$.ajax({
									url: '/project/item/mapping-outbound/save',
									method: 'post',
									dataType: 'json',
									data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data:mapping_data, is_active: is_active, enableLog: enableLog},
									success: function(response) {
										$("#outbound_mapping_setting_id").val(response.id);
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});

										swal({
											title: "Success!",
											text: "Outbound Mapping Setting Saved Successfully",
											type: "success",
											timer: 1200
										});

										if (inbound_format != '') {
											var inboundAutocompleteDataArrayOutboundReturn = inboundautocompletedata(inbound_format, "outbound");
										}

										if (outbound_format != '') {
											var outboundAutocompleteDataArrayOutboundReturn = outboundautocompletedata(outbound_format, "outbound");
										}

										inOutAutocompleteDataArrayOutbound = inboundAutocompleteDataArrayOutbound.concat(outboundAutocompleteDataArrayOutbound);
										numberedStepper.to(8);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							} else {
								$.ajax({
									url: '/project/item/mapping-outbound/updateByItemId/' + item_id,
									method: 'put',
									dataType: 'json',
									data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
									success: function (response) {
										$('.overlay, body').addClass('loaded');
										$('.overlay').css({'display':'none'});

										swal({
											title: "Success!",
											text: "Outbound Mapping Setting Saved Successfully",
											type: "success",
											timer: 1200
										});

										if (inbound_format != '') {
											var inboundAutocompleteDataArrayOutboundReturn = inboundautocompletedata(inbound_format, "outbound");
										}

										if (outbound_format != '') {
											var outboundAutocompleteDataArrayOutboundReturn = outboundautocompletedata(outbound_format, "outbound");
										}

										inOutAutocompleteDataArrayOutbound = inboundAutocompleteDataArrayOutbound.concat(outboundAutocompleteDataArrayOutbound);
										numberedStepper.to(8);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											$('.overlay, body').addClass('loaded');
											$('.overlay').css({'display':'none'});

											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});

											return false;
										}
									}
								});
							}

							var props_setting_id = $("#outbound_props_setting_id").val();
							if (currentItemPropertyOutboundEnable == 1) {
								var itemProperty = {},
									display = {},
									validation = {},
									format = {},
									itemPropertyKey = '';

								itemProperty = currentItemPropertyOutbound;

								display.value = $('#mapping-outbound-formula-props #props-outbound-display-value').val();
								display.defaultValue = $('#mapping-outbound-formula-props #props-outbound-display-default-value').val();
								itemProperty["display"] = display;

								validation.isRequired = $("#mapping-outbound-formula-props #props-outbound-validation-is-required option:selected").val();
								validation.valueMustbe = $("#mapping-outbound-formula-props #props-outbound-validation-value-must-be option:selected").val();
								var validationAdditonalRules = [];

								$("#prop-outbound-validation-additional-rules-table").find('tbody tr').each(function (i) {
									var validationAdditonalRule = {};
									var $fieldset = $(this);
									validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
									validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
									validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
									validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
									validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
									validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();
									validationAdditonalRules.push(validationAdditonalRule);
								});

								validation.additonal_rules = validationAdditonalRules;
								itemProperty["validation"] = validation;

								format.trim = $("#mapping-outbound-formula-props #props-outbound-format-is-trim option:selected").val();
								format.enableRounding = $("#mapping-outbound-formula-props #props-outbound-format-enable-rounding option:selected").val();
								format.enabeDecimal = $("#mapping-outbound-formula-props #props-outbound-format-enable-decimal option:selected").val();
								format.decimal = $('#mapping-outbound-formula-props #props-outbound-format-decimal').val();
								var formatAdditonalRules = [];

								$("#prop-outbound-format-additional-rules-table").find('tbody tr').each(function (i) {
									var formatAdditonalRule = {};
									var $fieldset = $(this);
									formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();

									if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
										formatAdditonalRule.formulato = $('select:eq(1) option:selected', $fieldset).val();
									} else {
										formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
									}

									if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING') {
										formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
									} else {
										formatAdditonalRule.formulatonew = '';
									}

									formatAdditonalRules.push(formatAdditonalRule);
								});

								format.additonal_rules = formatAdditonalRules;
								itemProperty["format"] = format;

								itemPropertyKey = itemProperty.general.itemKey;

								if (itemPropertiesOutbound.length > 0) {
									for (var i = 0; i < itemPropertiesOutbound.length; i++) {
										if (itemPropertiesOutbound[i].general.itemKey == itemPropertyKey) {
											itemPropertiesOutbound[i] = itemProperty;
											itemPropertyKey = '';
										}
									}
								}

								if (itemPropertyKey != "") {
									itemPropertiesOutbound.push(itemProperty);
								}
							}

							if (props_setting_id == "") {
								$.ajax({
									url: '/project/item/properties-outbound/save',
									method: 'post',
									dataType: 'json',
									data: {item_id: item_id, item_properties: itemPropertiesOutbound},
									success: function(response) {
										$("#outbound_props_setting_id").val(response.id);
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							} else {
								$.ajax({
									url: '/project/item/properties-outbound/updateByItemId/' + item_id,
									method: 'put',
									dataType: 'json',
									data: {item_id: item_id, item_properties: itemPropertiesOutbound, companyCode: dataCompanyCode},
									success: function(response) {
									},
									error: function(textStatus, error) {
										if (textStatus.responseJSON.status == 404) {
											window.location.href = "/404";
										} else {
											swal({
												title: "Error!",
												text: textStatus.responseJSON.message,
												type: "error",
												timer: 1200
											});
											return false;
										}
									}
								});
							}
						} else {
							alert("not valid");
						}
					} else if (index == 7) {
						inbound_start_date = $('#duration_inbound_start_date').val();
						outbound_start_date = $('#duration_outbound_start_date').val();
						var d = new Date();

						var month = d.getMonth() + 1;
						var day = d.getDate();

						var output = d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;

						if ($('#duration_inbound_start_date').val() == "") {
							$('#duration_inbound_start_date').val(output);
							document.getElementById("duration_inbound_start_date").setAttribute("min", output);
						}

						if ($('#duration_outbound_start_date').val() == "") {
							$('#duration_inbound_start_date').val(output);
							document.getElementById("duration_outbound_start_date").setAttribute("min", output);
						}

						var d = new Date(inbound_start_date);

						var month = d.getMonth() + 1;
						var day = d.getDate();

						var output = d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
						$('#duration_inbound_end_date').val(output);
						document.getElementById("duration_inbound_end_date").setAttribute("min", output);

						var d = new Date(outbound_start_date);

						var month = d.getMonth() + 1;
						var day = d.getDate();

						var output = d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
						$('#duration_outbound_end_date').val(output);
						document.getElementById("duration_outbound_end_date").setAttribute("min", output);

						if ($('input[name="duration_inbound_is_end_date"]:checked').val() == "no_end_date") {
							$('#duration_inbound_end_date').addClass('hidden');
						} else {
							$('#duration_inbound_end_date').removeClass('hidden');
						}

						if ($('input[name="duration_outbound_is_end_date"]:checked').val() == "no_end_date") {
							$('#duration_outbound_end_date').addClass('hidden');
						} else {
							$('#duration_outbound_end_date').removeClass('hidden');
						}
					} else {
						e.preventDefault();
					}
				} else {
					e.preventDefault();
				}
			});
		});

		$('#save_item').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-item').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				item_detail.ItemCode = $('#ItemCode').val();
				item_detail.ItemName = $('#ItemName').val();
				item_detail.CompanyName = $('#CompanyName').val();

				if (item_id == "") {
					$.ajax({
						url: '/projects/save',
						method: 'post',
						dataType: 'json',
						data: {ItemName: item_detail.ItemName, ItemCode: item_detail.ItemCode, CompanyName: item_detail.CompanyName},
						success: function(response) {
							$('#Item_id').val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/projects/project-update/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {ItemName: item_detail.ItemName, ItemCode: item_detail.ItemCode, CompanyName: item_detail.CompanyName, companyCode: dataCompanyCode},
						success: function(response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#save_inbound').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-inbound').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var inbound_setting_id = $("#inbound_setting_id").val();
				var inbound_format = $('#inboundFormat').val();
				var sync_type = $('input[name="sync_type"]:checked').val();
				var ftp_server_link = $('#ftp_server_link').val();
				var port = $('#port').val();
				var login_name = $('#login_name').val();
				var password = $('#password').val();
				var item_id = $('#Item_id').val();
				var folder = $('#folderpath').val();
				var backup_folder = $('#backup_folder').val();
				var is_password_encrypted = $('#is_password_encrypted').val();
				var is_active = $('#is_active_inbound').attr('data-value');
				var api_ddep_api = $('#api_ddep_api').val() == undefined ? "" : $('#api_ddep_api').val();
				var api_user_api = $('#api_user_api').val() == undefined ? "" : $('#api_user_api').val();
				var api_ddep_api_receive_parameter_name = $('#api_ddep_api_receive_parameter_name').val();
				var api_type = $('input[name="api_type"]:checked').val();
				var ddep_api_auth_type = $('#ddep_api_auth_type').val();
				var ddep_api_authorization_api_keys = authorizationApiKeyArray;
				var max_file_download = $('#max_file_download').val();
				var max_file_download_val = (max_file_download == '') ? 0 : max_file_download;
				var enableLog = $('input[name="inboundEnableLogs"]:checked').val();

				if (sync_type == 'API' && api_type == 'DDEP_API') {
					$('#inbound_shedule_setting_tab').hide();
					$('#outbound_shedule_setting_tab').hide();
					$('#inbound_ddep_api_selected').show();
					$('#outboud_max_post_file').hide();
					$('#collections_configure').show();
				}

				if (sync_type == 'API' && api_type == 'User_API') {
					$('#inbound_shedule_setting_tab').show();
					$('#outbound_shedule_setting_tab').hide();
					$('#inbound_ddep_api_selected').hide();
					$('#outboud_max_post_file').hide();
					$('#collections_configure').show();
				}

				if (sync_type == "FTP" || sync_type == "SFTP") {
					$('#inbound_shedule_setting_tab').show();
					$('#outbound_shedule_setting_tab').show();
					$('#inbound_ddep_api_selected').hide();
					$('#outboud_max_post_file').show();
					$('#collections_configure').hide();
				}

				if (inbound_setting_id == "") {
					$.ajax({
						url: '/inbound_setting/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, sync_type: sync_type, ftp_server_link: ftp_server_link, port: port, login_name: login_name, password: password, is_password_encrypted: is_password_encrypted, folder: folder, backup_folder: backup_folder, api_ddep_api: api_ddep_api, api_user_api: api_user_api, api_type: api_type, is_active: is_active, api_ddep_api_receive_parameter_name: api_ddep_api_receive_parameter_name, ddep_api_auth_type: ddep_api_auth_type, ddep_api_authorization_api_keys: ddep_api_authorization_api_keys, max_file_download: max_file_download_val, enableLog: enableLog},
						success: function(response) {
							$("#inbound_setting_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Inbound Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/inbound_setting/update/' + inbound_setting_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, sync_type: sync_type, ftp_server_link: ftp_server_link, port: port, login_name: login_name, password: password, is_password_encrypted: is_password_encrypted, folder: folder, backup_folder: backup_folder, api_ddep_api: api_ddep_api, api_user_api: api_user_api, api_type: api_type, is_active: is_active, api_ddep_api_receive_parameter_name: api_ddep_api_receive_parameter_name, ddep_api_auth_type: ddep_api_auth_type, ddep_api_authorization_api_keys: ddep_api_authorization_api_keys, max_file_download: max_file_download_val, companyCode: dataCompanyCode, enableLog: enableLog},
						success: function(response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Inbound Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#is_active_inbound').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-inbound').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var is_active = $(this).attr('data-value');
				var item_id = $('#Item_id').val();
				var inbound_setting_id = $('#inbound_setting_id').val();

				if (is_active == "Inactive") {
					is_active = "Active";
					$(this).attr('data-value',"Active");
					$(this).removeClass('btn-secondary');
					$(this).addClass('btn-success');
					$(this).html('Active');
				} else {
					is_active = "Inactive";
					$(this).attr('data-value',"Inactive");
					$(this).removeClass('btn-success');
					$(this).addClass('btn-secondary');
					$(this).html('Inactive')
				}

				var inbound_setting_id = $("#inbound_setting_id").val();
				var inbound_format = $('#inboundFormat').val();
				var sync_type = $('input[name="sync_type"]:checked').val();
				var ftp_server_link = $('#ftp_server_link').val();
				var port = $('#port').val();
				var login_name = $('#login_name').val();
				var password = $('#password').val();
				var folder = $('#folderpath').val();
				var backup_folder = $('#backup_folder').val();
				var is_password_encrypted = $('#is_password_encrypted').val();
				var api_ddep_api = $('#api_ddep_api').val() == undefined ? "" : $('#api_ddep_api').val();
				var api_user_api = $('#api_user_api').val() == undefined ? "" : $('#api_user_api').val();
				var api_ddep_api_receive_parameter_name = $('#api_ddep_api_receive_parameter_name').val();
				var api_type = $('input[name="api_type"]:checked').val();
				var ddep_api_auth_type = $('#ddep_api_auth_type').val();
				var ddep_api_authorization_api_keys = authorizationApiKeyArray;
				var max_file_download = $('#max_file_download').val();
				var max_file_download_val = (max_file_download == '') ? 0 : max_file_download;
				var enableLog = $('input[name="inboundEnableLogs"]:checked').val();

				if (inbound_setting_id == "") {
					$.ajax({
						url: '/inbound_setting/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, sync_type: sync_type, ftp_server_link: ftp_server_link, port: port, login_name: login_name, password: password, is_password_encrypted: is_password_encrypted, folder: folder, backup_folder: backup_folder, api_ddep_api: api_ddep_api, api_user_api: api_user_api, api_type: api_type, is_active: is_active, api_ddep_api_receive_parameter_name: api_ddep_api_receive_parameter_name, ddep_api_auth_type: ddep_api_auth_type, ddep_api_authorization_api_keys: ddep_api_authorization_api_keys, max_file_download: max_file_download_val, enableLog: enableLog},
						success: function(response) {
							$("#inbound_setting_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Inbound Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/inbound_setting/update/' + inbound_setting_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, sync_type: sync_type, ftp_server_link: ftp_server_link, port: port, login_name: login_name, password: password, is_password_encrypted: is_password_encrypted, folder: folder, backup_folder: backup_folder, api_ddep_api: api_ddep_api, api_user_api: api_user_api, api_type: api_type, is_active: is_active, api_ddep_api_receive_parameter_name: api_ddep_api_receive_parameter_name, ddep_api_auth_type: ddep_api_auth_type, ddep_api_authorization_api_keys: ddep_api_authorization_api_keys, max_file_download: max_file_download_val, companyCode: dataCompanyCode, enableLog: enableLog},
						success: function(response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Inbound Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#save_inbound_filter').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-inbound').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var inbound_filter_id = $("#inbound_filter_id").val();
				var is_active = $('#is_active_inbound_filter').attr('data-value');

				var inboundFilters = [];
				$("#inbound-filter-table").find('tbody tr').each(function (i) {
					var inboundFilter = {};
					var $fieldset = $(this);
					inboundFilter.logical = $('select:eq(0) option:selected', $fieldset).val();
					inboundFilter.original = $('input:text:eq(0)', $fieldset).val();
					inboundFilter.operations = $('select:eq(1) option:selected', $fieldset).val();
					inboundFilter.column = $('input:text:eq(1)', $fieldset).val();
					inboundFilters.push(inboundFilter);
				});

				var inbound_filter = inboundFilters;
				var enableLog = $('input[name="inboundFilterEnableLogs"]:checked').val();

				if (inbound_filter_id == "") {
					$.ajax({
						url: '/project/item/filter/inbound/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, inbound_filter: inbound_filter, is_active: is_active, enableLog: enableLog},
						success: function(response) {
							$("#inbound_filter_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Inbound Filter Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/filter/inbound/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, inbound_filter: inbound_filter, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
						success: function (response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Inbound Filter Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#is_active_inbound_filter').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-inbound').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var inbound_filter_id = $("#inbound_filter_id").val();
				var is_active = $(this).attr('data-value');

				if (is_active == "Inactive") {
					is_active = "Active";
					$(this).attr('data-value', "Active");
					$(this).removeClass('btn-secondary');
					$(this).addClass('btn-success');
					$(this).html('Active');
				} else {
					is_active = "Inactive";
					$(this).attr('data-value', "Inactive");
					$(this).removeClass('btn-success');
					$(this).addClass('btn-secondary');
					$(this).html('Inactive')
				}

				var inboundFilters = [];
				$("#inbound-filter-table").find('tbody tr').each(function (i) {
					var inboundFilter = {};
					var $fieldset = $(this);
					inboundFilter.logical = $('select:eq(0) option:selected', $fieldset).val();
					inboundFilter.original = $('input:text:eq(0)', $fieldset).val();
					inboundFilter.operations = $('select:eq(1) option:selected', $fieldset).val();
					inboundFilter.column = $('input:text:eq(1)', $fieldset).val();
					inboundFilters.push(inboundFilter);
				});

				var inbound_filter = inboundFilters;
				var enableLog = $('input[name="inboundFilterEnableLogs"]:checked').val();

				if (inbound_filter_id == "") {
					$.ajax({
						url: '/project/item/filter/inbound/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, inbound_filter: inbound_filter, is_active: is_active, enableLog: enableLog},
						success: function(response) {
							$("#inbound_filter_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Inbound Filter Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/filter/inbound/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, inbound_filter: inbound_filter, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
						success: function (response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Inbound Filter Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#save_outbound').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-outbound').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var outbound_setting_id = $('#outbound_setting_id').val();
				var is_active = $('#is_active_outbound').attr('data-value');
				var sync_type_out = $('input[name="sync_type_out"]:checked').val();
				var api_url = $('#api_url').val();
				var outbound_format = $('#outbound_format').val();
				var max_file_post = $('#max_file_post').val();
				var max_file_post_val = (max_file_post == '') ? 0 : max_file_post;
				var sendCollectionOnebyOne = $('input[name="sendCollectionOnebyOne"]:checked').val();
				var collections_name = $('#collections_name').val();
				var enableLog = $('input[name="outboundEnableLogs"]:checked').val();
				var specifyHeadersObj = (Object.keys(outboundSpecifyHeadersObj).length === 0) ? "" : outboundSpecifyHeadersObj
				var globalHeadersDataArr = [];

				$("#outbound-global-headers-table").find('tbody tr').each(function () {
					var globalHeadersDataObj = {};
					var $fieldset = $(this);
					if ($('input:text:eq(0)', $fieldset).val() && $('input:text:eq(1)', $fieldset).val()) {
						var isChecked = $('input:checkbox:eq(0)', $fieldset).is(":checked") ? "true" : "false";
						globalHeadersDataObj.status = isChecked;
						globalHeadersDataObj.key = $('input:text:eq(0)', $fieldset).val();
						globalHeadersDataObj.value = $('input:text:eq(1)', $fieldset).val();
						globalHeadersDataObj.description = $('input:text:eq(2)', $fieldset).val();

						globalHeadersDataArr.push(globalHeadersDataObj);
					}
				});

				if (globalHeadersDataArr.length <= 0) {
					globalHeadersDataArr = "";
				}

				if (outbound_setting_id == "") {
					$.ajax({
						url: '/outbound_setting/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, sync_type_out: sync_type_out, api_url: api_url, outbound_format: outbound_format, is_active: is_active, max_file_post: max_file_post_val, enableLog: enableLog, sendCollectionOnebyOne: sendCollectionOnebyOne, collections_name: collections_name, globalHeaders: globalHeadersDataArr, specifyHeaders: specifyHeadersObj},
						success: function(response) {
							$("#outbound_setting_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/outbound_setting/update/' + outbound_setting_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, sync_type_out: sync_type_out, api_url: api_url, outbound_format: outbound_format, is_active: is_active, max_file_post: max_file_post_val, companyCode: dataCompanyCode, enableLog: enableLog, sendCollectionOnebyOne: sendCollectionOnebyOne, collections_name: collections_name, globalHeaders: globalHeadersDataArr, specifyHeaders: specifyHeadersObj},
						success: function(response) {
							$("#outbound_setting_id").val(outbound_setting_id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#is_active_outbound').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-outbound').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var is_active = $(this).attr('data-value');

				if (is_active == "Inactive") {
					is_active = "Active";
					$(this).attr('data-value', "Active");
					$(this).removeClass('btn-secondary');
					$(this).addClass('btn-success');
					$(this).html('Active');
				} else {
					is_active = "Inactive";
					$(this).attr('data-value', "Inactive");
					$(this).removeClass('btn-success');
					$(this).addClass('btn-secondary');
					$(this).html('Inactive')
				}

				var item_id = $('#Item_id').val();
				var outbound_setting_id = $('#outbound_setting_id').val();
				var sync_type_out = $('input[name="sync_type_out"]:checked').val();
				var api_url = $('#api_url').val();
				var outbound_format = $('#outbound_format').val();
				var max_file_post = $('#max_file_post').val();
				var max_file_post_val = (max_file_post == '') ? 0 : max_file_post;
				var sendCollectionOnebyOne = $('input[name="sendCollectionOnebyOne"]:checked').val();
				var collections_name = $('#collections_name').val();
				var enableLog = $('input[name="outboundEnableLogs"]:checked').val();
				var specifyHeadersObj = (Object.keys(outboundSpecifyHeadersObj).length === 0) ? "" : outboundSpecifyHeadersObj
				var globalHeadersDataArr = [];

				$("#outbound-global-headers-table").find('tbody tr').each(function () {
					var globalHeadersDataObj = {};
					var $fieldset = $(this);
					if ($('input:text:eq(0)', $fieldset).val() && $('input:text:eq(1)', $fieldset).val()) {
						var isChecked = $('input:checkbox:eq(0)', $fieldset).is(":checked") ? "true" : "false";
						globalHeadersDataObj.status = isChecked;
						globalHeadersDataObj.key = $('input:text:eq(0)', $fieldset).val();
						globalHeadersDataObj.value = $('input:text:eq(1)', $fieldset).val();
						globalHeadersDataObj.description = $('input:text:eq(2)', $fieldset).val();

						globalHeadersDataArr.push(globalHeadersDataObj);
					}
				});

				if (globalHeadersDataArr.length <= 0) {
					globalHeadersDataArr = "";
				}

				if (outbound_setting_id == "") {
					$.ajax({
						url: '/outbound_setting/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, sync_type_out: sync_type_out, api_url: api_url, outbound_format: outbound_format, is_active: is_active, max_file_post: max_file_post_val, enableLog: enableLog, sendCollectionOnebyOne: sendCollectionOnebyOne, collections_name: collections_name, globalHeaders: globalHeadersDataArr, specifyHeaders: specifyHeadersObj},
						success: function(response) {
							$("#outbound_setting_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/outbound_setting/update/' + outbound_setting_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, sync_type_out: sync_type_out, api_url: api_url, outbound_format: outbound_format, is_active: is_active, max_file_post: max_file_post_val, companyCode: dataCompanyCode, enableLog: enableLog, sendCollectionOnebyOne: sendCollectionOnebyOne, collections_name: collections_name, globalHeaders: globalHeadersDataArr, specifyHeaders: specifyHeadersObj},
						success: function(response) {
							$("#outbound_setting_id").val(outbound_setting_id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#save_mapping').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-mapping').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var mapping_setting_id = $("#mapping_setting_id").val();
				var inbound_format = $("#InboundFormatData").val();
				var outbound_format = $('#OutboundFormatData').val();
				var mapping_data = $('#mySavedModel2').val();
				var is_active = $('#is_active_mapping').attr('data-value');
				var inbound_data_format = $("#inboundFormat").val();
				var outbound_data_format = $('#outbound_format').val();
				var enableLog = $('input[name="inboundMappingEnableLogs"]:checked').val();

				if (inbound_format != '') {
					var isJson = IsJsonString(inbound_format);
					if (inbound_data_format == 'json' && !isJson) {
						alert("Please fill in a correct inbound format JSON");
						return false;
					}

					if (inbound_data_format == 'xml' && isJson) {
						alert("Please fill in a correct inbound format XML");
						return false;
					}
				}

				if (outbound_format != '') {
					var isJson = IsJsonString(outbound_format);
					if (outbound_data_format == 'json' && !isJson) {
						alert("Please fill in a correct outbound format JSON");
						return false;
					}

					if (outbound_data_format == 'xml' && isJson) {
						alert("Please fill in a correct outbound format XML");
						return false;
					}
				}

				if (inbound_format == '' && outbound_format == '') {
					$('#InboundFormatData').val('');
					$('#OutboundFormatData').val('');
					$('#mySavedModel').val('');
					mapping_data = '';
					nodeDataArray = [];
					linkDataArray = [];
					myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
				}

				if (mapping_setting_id == "") {
					$.ajax({
						url: '/project/item/mapping/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog},
						success: function(response) {
							$("#mapping_setting_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Mapping Setting Saved Successfully",
								type: "success",
								timer: 1200
							});

							if (inbound_format != '') {
								var inboundAutocompleteDataArrayReturn = inboundautocompletedata(inbound_format, "inbound");
							}

							if (outbound_format != '') {
								var outboundAutocompleteDataArrayReturn = outboundautocompletedata(outbound_format, "inbound");
							}
							inOutAutocompleteDataArray = inboundAutocompleteDataArray.concat(outboundAutocompleteDataArray);
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/mapping/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
						success: function(response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Mapping Setting Saved Successfully",
								type: "success",
								timer: 1200
							});

							if (inbound_format != '') {
								var inboundAutocompleteDataArrayReturn = inboundautocompletedata(inbound_format, "inbound");
							}

							if (outbound_format != '') {
								var outboundAutocompleteDataArrayReturn = outboundautocompletedata(outbound_format, "inbound");
							}
							inOutAutocompleteDataArray = inboundAutocompleteDataArray.concat(outboundAutocompleteDataArray);
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}

				var props_setting_id = $("#props_setting_id").val();
				if (currentItemPropertyEnable == 1) {
					var itemProperty = {},
						display = {},
						validation = {},
						format = {},
						itemPropertyKey = '';

					itemProperty = currentItemProperty;

					display.value = $('#mapping-formula-props #props-display-value').val();
					display.defaultValue = $('#mapping-formula-props #props-display-default-value').val();
					itemProperty["display"] = display;

					validation.isRequired = $("#mapping-formula-props #props-validation-is-required option:selected").val();
					validation.valueMustbe = $("#mapping-formula-props #props-validation-value-must-be option:selected").val();

					var validationAdditonalRules = [];
					$("#prop-validation-additional-rules-table").find('tbody tr').each(function (i) {
						var validationAdditonalRule = {};
						var $fieldset = $(this);
						validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
						validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
						validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
						validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
						validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
						validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();
						validationAdditonalRules.push(validationAdditonalRule);
					});

					validation.additonal_rules = validationAdditonalRules;
					itemProperty["validation"] = validation;

					format.trim = $("#mapping-formula-props #props-format-is-trim option:selected").val();
					format.enableRounding = $("#mapping-formula-props #props-format-enable-rounding option:selected").val();
					format.enabeDecimal = $("#mapping-formula-props #props-format-enable-decimal option:selected").val();
					format.decimal = $('#mapping-formula-props #props-format-decimal').val();
					format.decimal = $('#mapping-formula-props #props-format-decimal').val();

					var formatAdditonalRules = [];
					$("#prop-format-additional-rules-table").find('tbody tr').each(function (i) {
						var formatAdditonalRule = {};
						var $fieldset = $(this);
						formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();

						if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
							formatAdditonalRule.formulato = $('select:eq(1) option:selected', $fieldset).val();
						} else {
							formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
						}

						if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING') {
							formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
						} else {
							formatAdditonalRule.formulatonew = '';
						}
						formatAdditonalRules.push(formatAdditonalRule);
					});

					format.additonal_rules = formatAdditonalRules;
					itemProperty["format"] = format;

					itemPropertyKey = itemProperty.general.itemKey;

					if (itemProperties.length > 0) {
						for (var i = 0; i < itemProperties.length; i++) {
							if (itemProperties[i].general.itemKey == itemPropertyKey) {
								itemProperties[i] = itemProperty;
								itemPropertyKey = '';
							}
						}
					}

					if (itemPropertyKey != "") {
						itemProperties.push(itemProperty);
					}
				}

				if (props_setting_id == "") {
					$.ajax({
						url: '/project/item/properties/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, item_properties: itemProperties},
						success: function(response) {
							$("#props_setting_id").val(response.id);
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/properties/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, item_properties: itemProperties, companyCode: dataCompanyCode},
						success: function(response) {
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#is_active_mapping').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-mapping').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var mapping_setting_id = $("#mapping_setting_id").val();
				var inbound_format = $("#InboundFormatData").val();
				var outbound_format = $('#OutboundFormatData').val();
				var mapping_data = $('#mySavedModel2').val();
				var is_active = $('#is_active_mapping').attr('data-value');
				var inbound_data_format = $("#inboundFormat").val();
				var outbound_data_format = $('#outbound_format').val();
				var enableLog = $('input[name="inboundMappingEnableLogs"]:checked').val();

				if (inbound_format != '') {
					var isJson = IsJsonString(inbound_format);
					if (inbound_data_format == 'json' && !isJson) {
						alert("Please fill in a correct inbound format JSON");
						return false;
					}

					if (inbound_data_format == 'xml' && isJson) {
						alert("Please fill in a correct inbound format XML");
						return false;
					}
				}

				if (outbound_format != '') {
					var isJson = IsJsonString(outbound_format);
					if (outbound_data_format == 'json' && !isJson) {
						alert("Please fill in a correct outbound format JSON");
						return false;
					}

					if (outbound_data_format == 'xml' && isJson) {
						alert("Please fill in a correct outbound format XML");
						return false;
					}
				}

				if (inbound_format == '' && outbound_format == '') {
					$('#InboundFormatData').val('');
					$('#OutboundFormatData').val('');
					$('#mySavedModel').val('');
					mapping_data = '';
					nodeDataArray = [];
					linkDataArray = [];
					myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
				}

				if (is_active == "Inactive") {
					is_active = "Active";
				} else {
					is_active = "Inactive";
				}

				if (mapping_setting_id == "") {
					$.ajax({
						url: '/project/item/mapping/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog},
						success: function(response) {
							$("#mapping_setting_id").val(response.id);

							if (is_active == "Inactive") {
								$('#is_active_mapping').attr('data-value', "Inactive");
								$('#is_active_mapping').removeClass('btn-success');
								$('#is_active_mapping').addClass('btn-secondary');
								$('#is_active_mapping').html('Inactive');
							} else {
								$('#is_active_mapping').attr('data-value', "Active");
								$('#is_active_mapping').removeClass('btn-secondary');
								$('#is_active_mapping').addClass('btn-success');
								$('#is_active_mapping').html('Active');
							}

							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Mapping Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/mapping/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
						success: function(response) {
							if (is_active == "Inactive") {
								$('#is_active_mapping').attr('data-value', "Inactive");
								$('#is_active_mapping').removeClass('btn-success');
								$('#is_active_mapping').addClass('btn-secondary');
								$('#is_active_mapping').html('Inactive');
							} else {
								$('#is_active_mapping').attr('data-value', "Active");
								$('#is_active_mapping').removeClass('btn-secondary');
								$('#is_active_mapping').addClass('btn-success');
								$('#is_active_mapping').html('Active');
							}

							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Mapping Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#save_outbound_filter').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-outbound').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var outbound_filter_id = $("#outbound_filter_id").val();
				var is_active = $('#is_active_outbound_filter').attr('data-value');

				var outboundFilters = [];
				$("#outbound-filter-table").find('tbody tr').each(function (i) {
					var outboundFilter = {};
					var $fieldset = $(this);
					outboundFilter.logical = $('select:eq(0) option:selected', $fieldset).val();
					outboundFilter.original = $('input:text:eq(0)', $fieldset).val();
					outboundFilter.operations = $('select:eq(1) option:selected', $fieldset).val();
					outboundFilter.column = $('input:text:eq(1)', $fieldset).val();
					outboundFilters.push(outboundFilter);
				});

				var outbound_filter = outboundFilters;
				var enableLog = $('input[name="outboundFilterEnableLogs"]:checked').val();

				if (outbound_filter_id == "") {
					$.ajax({
						url: '/project/item/filter/outbound/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, outbound_filter: outbound_filter, is_active: is_active, enableLog: enableLog},
						success: function(response) {
							$("#outbound_filter_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Filter Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/filter/outbound/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, outbound_filter: outbound_filter, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
						success: function (response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Filter Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#is_active_outbound_filter').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-outbound').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var outbound_filter_id = $("#outbound_filter_id").val();
				var is_active = $(this).attr('data-value');

				if (is_active == "Inactive") {
					is_active = "Active";
					$(this).attr('data-value', "Active");
					$(this).removeClass('btn-secondary');
					$(this).addClass('btn-success');
					$(this).html('Active');
				} else {
					is_active = "Inactive";
					$(this).attr('data-value', "Inactive");
					$(this).removeClass('btn-success');
					$(this).addClass('btn-secondary');
					$(this).html('Inactive')
				}

				var outboundFilters = [];
				$("#outbound-filter-table").find('tbody tr').each(function (i) {
					var outboundFilter = {};
					var $fieldset = $(this);
					outboundFilter.logical = $('select:eq(0) option:selected', $fieldset).val();
					outboundFilter.original = $('input:text:eq(0)', $fieldset).val();
					outboundFilter.operations = $('select:eq(1) option:selected', $fieldset).val();
					outboundFilter.column = $('input:text:eq(1)', $fieldset).val();
					outboundFilters.push(outboundFilter);
				});

				var outbound_filter = outboundFilters;
				var enableLog = $('input[name="outboundFilterEnableLogs"]:checked').val();

				if (outbound_filter_id == "") {
					$.ajax({
						url: '/project/item/filter/outbound/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, outbound_filter: outbound_filter, is_active: is_active, enableLog: enableLog},
						success: function(response) {
							$("#outbound_filter_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Filter Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/filter/outbound/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, outbound_filter: outbound_filter, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
						success: function (response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Filter Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#save_mapping_outbound').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-outbound-mapping').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var mapping_setting_id = $("#outbound_mapping_setting_id").val();
				var inbound_format = $("#InboundFormatData_outbound").val();
				var outbound_format = $('#OutboundFormatData_outbound').val();
				var mapping_data = $('#outboundmySavedModel2').val();
				var is_active = $('#is_active_outbound_mapping').attr('data-value');
				var inbound_data_format = $("#inboundFormat").val();
				var outbound_data_format = $('#outbound_format').val();
				var enableLog = $('input[name="outboundMappingEnableLogs"]:checked').val();

				if (inbound_format != '') {
					var isJson = IsJsonString(inbound_format);
					if (outbound_data_format == 'json' && !isJson) {
						alert("Please fill in a correct outbound format JSON");
						return false;
					}

					if (outbound_data_format == 'xml' && isJson) {
						alert("Please fill in a correct outbound format XML");
						return false;
					}
				}

				if (inbound_format == '' && outbound_format == '') {
					$('#InboundFormatData_outbound').val('');
					$('#OutboundFormatData_outbound').val('');
					$('#outboundmySavedModel').val('');
					mapping_data = '';
					nodeDataArray = [];
					linkDataArray = [];
					outboundmyDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
				}

				if (mapping_setting_id == "") {
					$.ajax({
						url: '/project/item/mapping-outbound/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog},
						success: function(response) {
							$("#outbound_mapping_setting_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Mapping Setting Saved Successfully",
								type: "success",
								timer: 1200
							});

							if (inbound_format != '') {
								var inboundAutocompleteDataArrayOutboundReturn = inboundautocompletedata(inbound_format, "outbound");
							}

							if (outbound_format != '') {
								var outboundAutocompleteDataArrayOutboundReturn = outboundautocompletedata(outbound_format, "outbound");
							}

							inOutAutocompleteDataArrayOutbound = inboundAutocompleteDataArrayOutbound.concat(outboundAutocompleteDataArrayOutbound);
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/mapping-outbound/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
						success: function(response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Mapping Setting Saved Successfully",
								type: "success",
								timer: 1200
							});

							if (inbound_format != '') {
								var inboundAutocompleteDataArrayOutboundReturn = inboundautocompletedata(inbound_format, "outbound");
							}

							if (outbound_format != '') {
								var outboundAutocompleteDataArrayOutboundReturn = outboundautocompletedata(outbound_format, "outbound");
							}

							inOutAutocompleteDataArrayOutbound = inboundAutocompleteDataArrayOutbound.concat(outboundAutocompleteDataArrayOutbound);
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}

				var props_setting_id = $("#outbound_props_setting_id").val();
				if (currentItemPropertyOutboundEnable == 1) {
					var itemProperty = {},
						display = {},
						validation = {},
						format = {},
						itemPropertyKey = '';

					itemProperty = currentItemPropertyOutbound;

					display.value = $('#mapping-outbound-formula-props #props-outbound-display-value').val();
					display.defaultValue = $('#mapping-outbound-formula-props #props-outbound-display-default-value').val();
					itemProperty["display"] = display;

					validation.isRequired = $("#mapping-outbound-formula-props #props-outbound-validation-is-required option:selected").val();
					validation.valueMustbe = $("#mapping-outbound-formula-props #props-outbound-validation-value-must-be option:selected").val();

					var validationAdditonalRules = [];
					$("#prop-outbound-validation-additional-rules-table").find('tbody tr').each(function (i) {
						var validationAdditonalRule = {};
						var $fieldset = $(this);
						validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
						validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
						validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
						validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
						validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
						validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();
						validationAdditonalRules.push(validationAdditonalRule);
					});

					validation.additonal_rules = validationAdditonalRules;
					itemProperty["validation"] = validation;

					format.trim = $("#mapping-outbound-formula-props #props-outbound-format-is-trim option:selected").val();
					format.enableRounding = $("#mapping-outbound-formula-props #props-outbound-format-enable-rounding option:selected").val();
					format.enabeDecimal = $("#mapping-outbound-formula-props #props-outbound-format-enable-decimal option:selected").val();
					format.decimal = $('#mapping-outbound-formula-props #props-outbound-format-decimal').val();

					var formatAdditonalRules = [];
					$("#prop-outbound-format-additional-rules-table").find('tbody tr').each(function (i) {
						var formatAdditonalRule = {};
						var $fieldset = $(this);
						formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();

						if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
							formatAdditonalRule.formulato = $('select:eq(1) option:selected', $fieldset).val();
						} else {
							formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
						}

						if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING') {
							formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
						} else {
							formatAdditonalRule.formulatonew = '';
						}
						formatAdditonalRules.push(formatAdditonalRule);
					});

					format.additonal_rules = formatAdditonalRules;
					itemProperty["format"] = format;

					itemPropertyKey = itemProperty.general.itemKey;

					if (itemPropertiesOutbound.length > 0) {
						for (var i = 0; i < itemPropertiesOutbound.length; i++) {
							if (itemPropertiesOutbound[i].general.itemKey == itemPropertyKey) {
								itemPropertiesOutbound[i] = itemProperty;
								itemPropertyKey = '';
							}
						}
					}

					if (itemPropertyKey != "") {
						itemPropertiesOutbound.push(itemProperty);
					}
				}

				if (props_setting_id == "") {
					$.ajax({
						url: '/project/item/properties-outbound/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, item_properties: itemPropertiesOutbound},
						success: function(response) {
							$("#outbound_props_setting_id").val(response.id);
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/properties-outbound/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, item_properties: itemPropertiesOutbound, companyCode: dataCompanyCode},
						success: function(response) {
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#is_active_outbound_mapping').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-outbound-mapping').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var mapping_setting_id = $("#outbound_mapping_setting_id").val();
				var inbound_format = $("#InboundFormatData_outbound").val();
				var outbound_format = $('#OutboundFormatData_outbound').val();
				var mapping_data = $('#outboundmySavedModel2').val();
				var is_active = $('#is_active_outbound_mapping').attr('data-value');
				var inbound_data_format = $("#inboundFormat").val();
				var outbound_data_format = $('#outbound_format').val();
				var enableLog = $('input[name="outboundMappingEnableLogs"]:checked').val();

				if (inbound_format != '') {
					var isJson = IsJsonString(inbound_format);
					if (outbound_data_format == 'json' && !isJson) {
						alert("Please fill in a correct outbound format JSON");
						return false;
					}

					if (outbound_data_format == 'xml' && isJson) {
						alert("Please fill in a correct outbound format XML");
						return false;
					}
				}

				if (inbound_format == '' && outbound_format == '') {
					$('#InboundFormatData_outbound').val('');
					$('#OutboundFormatData_outbound').val('');
					$('#outboundmySavedModel').val('');
					mapping_data = '';
					nodeDataArray = [];
					linkDataArray = [];
					outboundmyDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
				}

				if (is_active == "Inactive") {
					is_active = "Active";
				} else {
					is_active = "Inactive";
				}

				if (mapping_setting_id == "") {
					$.ajax({
						url: '/project/item/mapping-outbound/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog},
						success: function(response) {
							$("#outbound_mapping_setting_id").val(response.id);

							if (is_active == "Inactive") {
								$('#is_active_outbound_mapping').attr('data-value', "Inactive");
								$('#is_active_outbound_mapping').removeClass('btn-success');
								$('#is_active_outbound_mapping').addClass('btn-secondary');
								$('#is_active_outbound_mapping').html('Inactive');
							} else {
								$('#is_active_outbound_mapping').attr('data-value', "Active");
								$('#is_active_outbound_mapping').removeClass('btn-secondary');
								$('#is_active_outbound_mapping').addClass('btn-success');
								$('#is_active_outbound_mapping').html('Active');
							}

							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Mapping Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/project/item/mapping-outbound/updateByItemId/' + item_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, inbound_format: inbound_format, outbound_format: outbound_format, mapping_data: mapping_data, is_active: is_active, enableLog: enableLog, companyCode: dataCompanyCode},
						success: function(response) {
							if (is_active == "Inactive") {
								$('#is_active_outbound_mapping').attr('data-value', "Inactive");
								$('#is_active_outbound_mapping').removeClass('btn-success');
								$('#is_active_outbound_mapping').addClass('btn-secondary');
								$('#is_active_outbound_mapping').html('Inactive');
							} else {
								$('#is_active_outbound_mapping').attr('data-value', "Active");
								$('#is_active_outbound_mapping').removeClass('btn-secondary');
								$('#is_active_outbound_mapping').addClass('btn-success');
								$('#is_active_outbound_mapping').html('Active');
							}

							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Mapping Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#outbound_validation_save').on('click', function(e) {
			e.preventDefault();
			var isValid = $('#frm-save-outbound').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var item_id = $('#Item_id').val();
				var outbound_validation_id = $('#outbound_validation_id').val();
				var formdata = new FormData(document.getElementById("frm-save-outbound-validation"));
				var formDataArr = [];

				$("#outbound-validation-rules-table").find('tbody tr').each(function () {
					var formDataObj = {};
					var $fieldset = $(this);
					formDataObj.logical = $('select:eq(0) option:selected', $fieldset).val();
					formDataObj.original = $('input:text:eq(0)', $fieldset).val();
					formDataObj.operations = $('select:eq(1) option:selected', $fieldset).val();
					formDataObj.column = $('input:text:eq(1)', $fieldset).val();
					formDataObj.then = $('select:eq(2) option:selected', $fieldset).val();
					formDataObj.formula = $('input:text:eq(2)', $fieldset).val();
					formDataArr.push(formDataObj);
				});

				if (formDataArr.length <= 0) {
					formDataArr = '';
				}

				if (outbound_validation_id == "") {
					$.ajax({
						url: '/outbound_validation/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, validations: formDataArr},
						success: function(response) {
							$("#outbound_validation_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Validation Saved Successfully",
								type: "success",
								timer: 1200
							});
							var modal = document.getElementById("outbound-validation-modal");
							modal.style.display = "none";
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/outbound_validation/update/' + outbound_validation_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, validations: formDataArr, companyCode: dataCompanyCode},
						success: function(response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Outbound Validation Saved Successfully",
								type: "success",
								timer: 1200
							});
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('#outbound_specify_headers_save').on('click', function(e) {
			e.preventDefault();

			var specifyHeadersDataArr = [];
			var headerId = $('#outbound_specify_headers_id').val();

			$("#outbound-specify-headers-table").find('tbody tr').each(function () {
				var specifyHeadersDataObj = {};
				var $fieldset = $(this);
				if ($('input:text:eq(0)', $fieldset).val() && $('input:text:eq(1)', $fieldset).val()) {
					var isChecked = $('input:checkbox:eq(0)', $fieldset).is(":checked") ? "true" : "false";
					specifyHeadersDataObj.status = isChecked;
					specifyHeadersDataObj.key = $('input:text:eq(0)', $fieldset).val();
					specifyHeadersDataObj.value = $('input:text:eq(1)', $fieldset).val();
					specifyHeadersDataObj.description = $('input:text:eq(2)', $fieldset).val();

					specifyHeadersDataArr.push(specifyHeadersDataObj);
				}
			});

			if (specifyHeadersDataArr.length > 0) {
				outboundSpecifyHeadersObj[headerId] = specifyHeadersDataArr;
			} else {
				if (outboundSpecifyHeadersObj[headerId]) {
					delete outboundSpecifyHeadersObj[headerId]
				}
			}

			var outboundSpecifyHeadersModal = document.getElementById("outbound-specify-headers-modal");
			outboundSpecifyHeadersModal.style.display = "none";
		});

		$('#prop-validation-additional-rules-btn-save, #prop-format-additional-rules-btn-save').on('click', function(e) {
			e.preventDefault();
			let itemProperty = {},
				display = {},
				validation = {},
				format = {},
				itemPropertyKey = '';

			let itemKey = $('#props-display-value').val();
			let general = {};
			general.itemName = $('#props-general-item').html();
			general.itemKey = itemKey.replace('=', '');

			currentItemProperty = {};
			currentItemProperty["general"] = general;

			itemProperty = currentItemProperty;

			display.value = $('#mapping-formula-props #props-display-value').val();
			display.defaultValue = $('#mapping-formula-props #props-display-default-value').val();
			itemProperty["display"] = display;

			validation.isRequired = $("#mapping-formula-props #props-validation-is-required option:selected").val();
			validation.valueMustbe = $("#mapping-formula-props #props-validation-value-must-be option:selected").val();

			var validationAdditonalRules = [];
			$("#prop-validation-additional-rules-table").find('tbody tr').each(function (i) {
				var validationAdditonalRule = {};
				var $fieldset = $(this);
				validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
				validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
				validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
				validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
				validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
				validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();
				validationAdditonalRules.push(validationAdditonalRule);
			});

			validation.additonal_rules = validationAdditonalRules;
			itemProperty["validation"] = validation;

			format.trim = $("#mapping-formula-props #props-format-is-trim option:selected").val();
			format.enableRounding = $("#mapping-formula-props #props-format-enable-rounding option:selected").val();
			format.enabeDecimal = $("#mapping-formula-props #props-format-enable-decimal option:selected").val();
			format.decimal = $('#mapping-formula-props #props-format-decimal').val();
			format.decimal = $('#mapping-formula-props #props-format-decimal').val();

			var formatAdditonalRules = [];
			$("#prop-format-additional-rules-table").find('tbody tr').each(function (i) {
				var formatAdditonalRule = {};
				var $fieldset = $(this);

				formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();
				if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
					formatAdditonalRule.formulato = $('select:eq(0) option:selected', $fieldset).val();
				} else {
					formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
				}

				if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING') {
					formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
				} else {
					formatAdditonalRule.formulatonew = '';
				}
				formatAdditonalRules.push(formatAdditonalRule);
			});

			format.additonal_rules = formatAdditonalRules;
			itemProperty["format"] = format;

			itemPropertyKey = itemProperty.general.itemKey;

			if (itemProperties.length > 0) {
				for (var i = 0; i < itemProperties.length; i++) {
					if (itemProperties[i].general.itemKey == itemPropertyKey) {
						itemProperties[i] = itemProperty;
						itemPropertyKey = '';
					}
				}
			}

			if (itemPropertyKey != "") {
				itemProperties.push(itemProperty);
			}

			currentItemPropertyEnable = 0;

			var propValidationAdditionalRulesModal = document.getElementById("props-validation-additional-rules-modal-btn");
			propValidationAdditionalRulesModal.style.display = "none";
			var propFormatAdditionalRulesModal = document.getElementById("props-format-additional-rules-modal-btn");
			propFormatAdditionalRulesModal.style.display = "none";
		});

		$('#prop-outbound-validation-additional-rules-btn-save, #prop-outbound-format-additional-rules-btn-save').on('click', function(e) {
			e.preventDefault();
			var itemProperty = {},
				display = {},
				validation = {},
				format = {},
				itemPropertyKey = '';

			let itemKey = $('#props-outbound-display-value').val();
			var general = {};
			general.itemName = $('#props-outbound-general-item').html();
			general.itemKey = itemKey.replace('=', '');

			currentItemPropertyOutbound = {};
			currentItemPropertyOutbound["general"] = general;

			itemProperty = currentItemPropertyOutbound;

			display.value = $('#mapping-outbound-formula-props #props-outbound-display-value').val();
			display.defaultValue = $('#mapping-outbound-formula-props #props-outbound-display-default-value').val();
			itemProperty["display"] = display;

			validation.isRequired = $("#mapping-outbound-formula-props #props-outbound-validation-is-required option:selected").val();
			validation.valueMustbe = $("#mapping-outbound-formula-props #props-outbound-validation-value-must-be option:selected").val();

			var validationAdditonalRules = [];
			$("#prop-outbound-validation-additional-rules-table").find('tbody tr').each(function (i) {
				var validationAdditonalRule = {};
				var $fieldset = $(this);
				validationAdditonalRule.logical = $('select:eq(0) option:selected', $fieldset).val();
				validationAdditonalRule.original = $('input:text:eq(0)', $fieldset).val();
				validationAdditonalRule.operations = $('select:eq(1) option:selected', $fieldset).val();
				validationAdditonalRule.column = $('input:text:eq(1)', $fieldset).val();
				validationAdditonalRule.then = $('select:eq(2) option:selected', $fieldset).val();
				validationAdditonalRule.formula = $('input:text:eq(2)', $fieldset).val();
				validationAdditonalRules.push(validationAdditonalRule);
			});

			validation.additonal_rules = validationAdditonalRules;
			itemProperty["validation"] = validation;

			format.trim = $("#mapping-outbound-formula-props #props-outbound-format-is-trim option:selected").val();
			format.enableRounding = $("#mapping-outbound-formula-props #props-outbound-format-enable-rounding option:selected").val();
			format.enabeDecimal = $("#mapping-outbound-formula-props #props-outbound-format-enable-decimal option:selected").val();
			format.decimal = $('#mapping-outbound-formula-props #props-outbound-format-decimal').val();
			format.decimal = $('#mapping-outbound-formula-props #props-outbound-format-decimal').val();

			var formatAdditonalRules = [];
			$("#prop-outbound-format-additional-rules-table").find('tbody tr').each(function (i) {
				var formatAdditonalRule = {};
				var $fieldset = $(this);

				formatAdditonalRule.name = $('select:eq(0) option:selected', $fieldset).val();
				if (formatAdditonalRule.name == 'TRIM' || formatAdditonalRule.name == 'LEFT TRIM' || formatAdditonalRule.name == 'RIGHT TRIM') {
					formatAdditonalRule.formulato = $('select:eq(0) option:selected', $fieldset).val();
				} else {
					formatAdditonalRule.formulato = $('input:text:eq(0)', $fieldset).val();
				}

				if (formatAdditonalRule.name == 'REPLACE' || formatAdditonalRule.name == 'SUBSTRING') {
					formatAdditonalRule.formulatonew = $('input:text:eq(1)', $fieldset).val();
				} else {
					formatAdditonalRule.formulatonew = '';
				}
				formatAdditonalRules.push(formatAdditonalRule);
			});

			format.additonal_rules = formatAdditonalRules;
			itemProperty["format"] = format;

			itemPropertyKey = itemProperty.general.itemKey;

			if (itemPropertiesOutbound.length > 0) {
				for (var i = 0; i < itemPropertiesOutbound.length; i++) {
					if (itemPropertiesOutbound[i].general.itemKey == itemPropertyKey) {
						itemPropertiesOutbound[i] = itemProperty;
						itemPropertyKey = '';
					}
				}
			}

			if (itemPropertyKey != "") {
				itemPropertiesOutbound.push(itemProperty);
			}

			currentItemPropertyOutboundEnable = 0;

			var propValidationAdditionalRulesModal = document.getElementById("props-outbound-validation-additional-rules-modal-btn");
			propValidationAdditionalRulesModal.style.display = "none";
			var propFormatAdditionalRulesModal = document.getElementById("props-outbound-format-additional-rules-modal-btn");
			propFormatAdditionalRulesModal.style.display = "none";
		});

		$(horizontalWizard)
		.find('.btn-prev')
		.on('click', function () {
			numberedStepper.previous();
		});

		$(horizontalWizard)
		.find('.btn-submit')
		.on('click', function () {
			var isValid = $(this).parent().siblings('form').valid();
			if (isValid) {
				$('.overlay, body').removeClass('loaded');
				$('.overlay').css({'display':'block'});

				var schedule_setting_id = $('#schedule_setting_id').val();
				var item_id = $('#Item_id').val();
				var Schedule_configure_inbound = $('input[name="s_configure_inbound"]:checked').val();
				var schedule_type_inbound = $('input[name="schedule_type_inbound"]:checked').val();
				var one_time_occurrence_inbound_date = "";
				var one_time_occurrence_inbound_time = "";
				var one_time_occurrence_outbound_date = "";
				var one_time_occurrence_outbound_time = "";

				if (schedule_type_inbound == 'OneTime') {
					one_time_occurrence_inbound_date = $('#one_time_occurrence_inbound_date').val();
					one_time_occurrence_inbound_time = $('#one_time_occurrence_inbound_time').val();
				}

				var day_frequency_inbound_count = $('#day_frequency_inbound_count').val();
				var day_frequency_outbound_count = $('#day_frequency_outbound_count').val();
				var weekly_frequency_inbound_count = $('#weekly_frequency_inbound_count').val();
				var weekly_frequency_outbound_count = $('#weekly_frequency_outbound_count').val();
				var monthly_frequency_day_inbound = $('#monthly_frequency_day_inbound').val();
				var monthly_frequency_day_inbound_count = $('#monthly_frequency_day_inbound_count').val();
				var monthly_frequency_day_outbound = $('#monthly_frequency_day_outbound').val();
				var monthly_frequency_day_outbound_count = $('#monthly_frequency_day_outbound_count').val();
				var monthly_frequency_the_inbound_count = $('#monthly_frequency_the_inbound_count').val();
				var monthly_frequency_the_outbound_count = $('#monthly_frequency_the_outbound_count').val();
				var daily_frequency_type_inbound = $('input[name=daily_frequency_type_inbound]:checked').val();
				var daily_frequency_type_outbound = $('input[name=daily_frequency_type_outbound]:checked').val();
				var daily_frequency_once_time_inbound = $('#daily_frequency_once_time_inbound').val();
				var daily_frequency_once_time_outbound = $('#daily_frequency_once_time_outbound').val();
				var daily_frequency_every_time_unit_inbound = $('#daily_frequency_every_time_unit_inbound').val();
				var daily_frequency_every_time_unit_outbound = $('#daily_frequency_every_time_unit_outbound').val();
				var daily_frequency_every_time_count_inbound = $('#daily_frequency_every_time_count_inbound').val();
				var daily_frequency_every_time_count_outbound = $('#daily_frequency_every_time_count_outbound').val();
				var daily_frequency_every_time_count_start_inbound = $('#daily_frequency_every_time_count_start_inbound').val();
				var daily_frequency_every_time_count_end_inbound = $('#daily_frequency_every_time_count_end_inbound').val();
				var daily_frequency_every_time_count_end_outbound = $('#daily_frequency_every_time_count_end_outbound').val();
				var daily_frequency_every_time_count_start_outbound = $('#daily_frequency_every_time_count_start_outbound').val();
				var monthly_field_setting_inbound = [];
				var monthly_field_setting_outbound = [];
				var occurs_weekly_fields_inbound = [];
				var occurs_weekly_fields_outbound = [];
				var duration_inbound_end_date = $('#duration_inbound_end_date').val();
				var duration_inbound_start_date = $('#duration_inbound_start_date').val();
				var duration_inbound_is_end_date = $('input[name="duration_inbound_is_end_date"]:checked').val();
				var duration_outbound_end_date = $('#duration_outbound_end_date').val();
				var duration_outbound_start_date = $('#duration_outbound_start_date').val();
				var duration_outbound_is_end_date = $('input[name="duration_outbound_is_end_date"]:checked').val();

				var occurs_inbound = $('#occurs_time_inbound').val();
				if (occurs_inbound == "daily") {
				} else if (occurs_inbound == "monthly") {
					var inbound_monthly_day = $('input[name=inbound_monthly_day]:checked').val();
					if (inbound_monthly_day == "day") {
						var temp_obj = {};
						temp_obj['inbound_monthly_day'] = "day";
						monthly_field_setting_inbound.push(temp_obj);
					} else {
						var temp_obj = {};
						var the_day_of = $('#the_day_of').val();
						var the_days = $('#the_days').val();
						temp_obj['inbound_monthly_day'] = "the";
						temp_obj['the_day_of'] = the_day_of;
						temp_obj['the_days'] = the_days;
						monthly_field_setting_inbound.push(temp_obj);
					}
				} else if (occurs_inbound == "weekly") {
					$('input[name = occurs_weekly_fields_inbound]:checked').each(function() {
						var tmp_week_obj = {}
						tmp_week_obj['day'] = $(this).val();
						occurs_weekly_fields_inbound.push(tmp_week_obj);
					});
				}

				var Schedule_configure_outbound = $('input[name="s_configure_outbound"]:checked').val();
				var schedule_type_outbound = $('input[name="schedule_type_outbound"]:checked').val();
				if (schedule_type_outbound == 'OneTime') {
					one_time_occurrence_outbound_date = $('#one_time_occurrence_outbound_date').val();
					one_time_occurrence_outbound_time = $('#one_time_occurrence_outbound_time').val();
				}

				var occurs_outbound = $('#occurs_time_outbound').val();
				if (occurs_outbound == "daily") {
				} else if (occurs_outbound == "monthly") {
					var outbound_monthly_day = $('input[name=outbound_monthly_day]:checked').val();
					if (outbound_monthly_day == "day") {
						var temp_obj = {};
						temp_obj['outbound_monthly_day'] = "day";
						monthly_field_setting_outbound.push(temp_obj);
					} else {
						var temp_obj = {};
						var the_day_of_outbound = $('#the_day_of_outbound').val();
						var the_days_outbound = $('#the_days_outbound').val();
						temp_obj['outbound_monthly_day'] = "the";
						temp_obj['the_day_of'] = the_day_of_outbound;
						temp_obj['the_days'] = the_days_outbound;
						monthly_field_setting_outbound.push(temp_obj);
					}
				} else if (occurs_outbound == "weekly") {
					$('input[name = occurs_weekly_fields_outbound]:checked').each(function(){
						var tmp_week_obj = {}
						tmp_week_obj['day'] = $(this).val();
						occurs_weekly_fields_outbound.push(tmp_week_obj);
					});
				}

				var next_date_inbound_start = new Date($("#duration_inbound_start_date").val());
				next_date_inbound_start.setSeconds(0);
				next_date_inbound_start.setMilliseconds(0);
				var next_date_inbound_string = next_date_inbound_start.toUTCString();
				var next_date_inbound = parseInt(next_date_inbound_start.getTime() + (next_date_inbound_start.getTimezoneOffset() * 60 * 1000));
				var next_date_outbound_start = new Date($("#duration_outbound_start_date").val());
				next_date_outbound_start.setSeconds(0);
				next_date_outbound_start.setMilliseconds(0);
				var next_date_outbound_string = next_date_outbound_start.toUTCString();
				var next_date_outbound = parseInt(next_date_outbound_start.getTime() + (next_date_outbound_start.getTimezoneOffset() * 60 * 1000));

				if (daily_frequency_type_inbound == "Occurs Once At") {
					var inbound_time = daily_frequency_once_time_inbound;
					var inbound_parts = inbound_time.split(":");
					var result_inbound = milliseconds(inbound_parts[0],inbound_parts[1], 0);
					next_date_inbound = parseInt(next_date_inbound + result_inbound);
				} else {
					var inbound_time = daily_frequency_every_time_count_start_inbound
					var inbound_parts = inbound_time.split(":");
					var result_inbound = milliseconds(inbound_parts[0], inbound_parts[1], 0);
					next_date_inbound = parseInt(next_date_inbound + result_inbound);
				}

				if (daily_frequency_type_outbound == "Occurs Once At") {
					var outbound_time = daily_frequency_once_time_outbound;
					var outbound_parts = outbound_time.split(":");
					var result_outbound = milliseconds(outbound_parts[0], outbound_parts[1], 0);
					next_date_outbound = parseInt(next_date_outbound + result_outbound);
				} else {
					var outbound_time=daily_frequency_every_time_count_start_outbound
					var outbound_parts = outbound_time.split(":");
					var result_outbound = milliseconds(outbound_parts[0], outbound_parts[1], 0);
					next_date_outbound = parseInt(next_date_outbound+result_outbound);
				}

				var enableLog = $('input[name="ScheduleEnableLogs"]:checked').val();

				if (schedule_setting_id == "") {
					$.ajax({
						url: '/schedule_setting/save',
						method: 'post',
						dataType: 'json',
						data: {item_id: item_id, Schedule_configure_inbound: Schedule_configure_inbound, schedule_type_inbound: schedule_type_inbound, one_time_occurrence_inbound_date: one_time_occurrence_inbound_date, one_time_occurrence_inbound_time: one_time_occurrence_inbound_time, occurs_inbound: occurs_inbound, monthly_field_setting_inbound: monthly_field_setting_inbound, occurs_weekly_fields_inbound: occurs_weekly_fields_inbound, day_frequency_inbound_count: day_frequency_inbound_count, day_frequency_outbound_count: day_frequency_outbound_count, weekly_frequency_inbound_count: weekly_frequency_inbound_count, weekly_frequency_outbound_count: weekly_frequency_outbound_count, monthly_frequency_day_inbound: monthly_frequency_day_inbound, monthly_frequency_day_inbound_count: monthly_frequency_day_inbound_count, monthly_frequency_day_outbound: monthly_frequency_day_outbound, monthly_frequency_day_outbound_count: monthly_frequency_day_outbound_count, monthly_frequency_the_inbound_count: monthly_frequency_the_inbound_count, monthly_frequency_the_outbound_count: monthly_frequency_the_outbound_count, daily_frequency_type_inbound: daily_frequency_type_inbound, daily_frequency_type_outbound: daily_frequency_type_outbound, daily_frequency_once_time_inbound: daily_frequency_once_time_inbound, daily_frequency_once_time_outbound: daily_frequency_once_time_outbound, daily_frequency_every_time_unit_inbound: daily_frequency_every_time_unit_inbound, daily_frequency_every_time_unit_outbound: daily_frequency_every_time_unit_outbound, daily_frequency_every_time_count_inbound: daily_frequency_every_time_count_inbound, daily_frequency_every_time_count_outbound: daily_frequency_every_time_count_outbound, daily_frequency_every_time_count_start_inbound: daily_frequency_every_time_count_start_inbound, daily_frequency_every_time_count_end_inbound: daily_frequency_every_time_count_end_inbound, daily_frequency_every_time_count_end_outbound: daily_frequency_every_time_count_end_outbound, daily_frequency_every_time_count_start_outbound: daily_frequency_every_time_count_start_outbound, Schedule_configure_outbound: Schedule_configure_outbound, schedule_type_outbound: schedule_type_outbound, one_time_occurrence_outbound_date: one_time_occurrence_outbound_date, one_time_occurrence_outbound_time: one_time_occurrence_outbound_time, occurs_outbound: occurs_outbound, monthly_field_setting_outbound: monthly_field_setting_outbound, occurs_weekly_fields_outbound: occurs_weekly_fields_outbound, duration_inbound_start_date: duration_inbound_start_date, duration_inbound_is_end_date: duration_inbound_is_end_date, duration_inbound_end_date: duration_inbound_end_date, duration_outbound_start_date: duration_outbound_start_date, duration_outbound_is_end_date: duration_outbound_is_end_date, duration_outbound_end_date: duration_outbound_end_date, next_date_inbound: next_date_inbound, next_date_outbound: next_date_outbound, enableLog: enableLog},
						success: function(response) {
							$("#schedule_setting_id").val(response.id);
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Schedule Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
							window.location.href = "/projects/project-list";
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				} else {
					$.ajax({
						url: '/schedule_setting/update/' + schedule_setting_id,
						method: 'put',
						dataType: 'json',
						data: {item_id: item_id, Schedule_configure_inbound: Schedule_configure_inbound, schedule_type_inbound: schedule_type_inbound, one_time_occurrence_inbound_date: one_time_occurrence_inbound_date, one_time_occurrence_inbound_time: one_time_occurrence_inbound_time, occurs_inbound: occurs_inbound, monthly_field_setting_inbound: monthly_field_setting_inbound, occurs_weekly_fields_inbound: occurs_weekly_fields_inbound, day_frequency_inbound_count: day_frequency_inbound_count, day_frequency_outbound_count: day_frequency_outbound_count, weekly_frequency_inbound_count: weekly_frequency_inbound_count, weekly_frequency_outbound_count: weekly_frequency_outbound_count, monthly_frequency_day_inbound: monthly_frequency_day_inbound, monthly_frequency_day_inbound_count: monthly_frequency_day_inbound_count, monthly_frequency_day_outbound: monthly_frequency_day_outbound, monthly_frequency_day_outbound_count: monthly_frequency_day_outbound_count, monthly_frequency_the_inbound_count: monthly_frequency_the_inbound_count, monthly_frequency_the_outbound_count: monthly_frequency_the_outbound_count, daily_frequency_type_inbound: daily_frequency_type_inbound, daily_frequency_type_outbound: daily_frequency_type_outbound, daily_frequency_once_time_inbound: daily_frequency_once_time_inbound, daily_frequency_once_time_outbound: daily_frequency_once_time_outbound, daily_frequency_every_time_unit_inbound: daily_frequency_every_time_unit_inbound, daily_frequency_every_time_unit_outbound: daily_frequency_every_time_unit_outbound, daily_frequency_every_time_count_inbound: daily_frequency_every_time_count_inbound, daily_frequency_every_time_count_outbound: daily_frequency_every_time_count_outbound, daily_frequency_every_time_count_start_inbound: daily_frequency_every_time_count_start_inbound, daily_frequency_every_time_count_end_inbound: daily_frequency_every_time_count_end_inbound, daily_frequency_every_time_count_end_outbound: daily_frequency_every_time_count_end_outbound, daily_frequency_every_time_count_start_outbound: daily_frequency_every_time_count_start_outbound, Schedule_configure_outbound: Schedule_configure_outbound, schedule_type_outbound: schedule_type_outbound, one_time_occurrence_outbound_date: one_time_occurrence_outbound_date, one_time_occurrence_outbound_time: one_time_occurrence_outbound_time, occurs_outbound: occurs_outbound, monthly_field_setting_outbound: monthly_field_setting_outbound, occurs_weekly_fields_outbound: occurs_weekly_fields_outbound, duration_inbound_start_date: duration_inbound_start_date, duration_inbound_is_end_date: duration_inbound_is_end_date, duration_inbound_end_date: duration_inbound_end_date, duration_outbound_start_date: duration_outbound_start_date, duration_outbound_is_end_date: duration_outbound_is_end_date, duration_outbound_end_date: duration_outbound_end_date, next_date_inbound: next_date_inbound, next_date_outbound: next_date_outbound, companyCode: dataCompanyCode, enableLog: enableLog},
						success: function(response) {
							$('.overlay, body').addClass('loaded');
							$('.overlay').css({'display':'none'});
							swal({
								title: "Success!",
								text: "Schedule Setting Saved Successfully",
								type: "success",
								timer: 1200
							});
							window.location.href = "/projects/project-list";
						},
						error: function(textStatus, error) {
							if (textStatus.responseJSON.status == 404) {
								window.location.href = "/404";
							} else {
								$('.overlay, body').addClass('loaded');
								$('.overlay').css({'display':'none'});
								swal({
									title: "Error!",
									text: textStatus.responseJSON.message,
									type: "error",
									timer: 1200
								});
								return false;
							}
						}
					});
				}
			} else {
				alert("not valid");
			}
		});

		$('input[name=s_configure_inbound]').on('change', function() {
			if ($(this).val() == 'click_by_user') {
				$('div.relation-schedule-open').slideUp('slow');
			} else {
				$('div.relation-schedule-open').slideDown('slow');
			}
		});

		$('input[name=s_configure_outbound]').on('change', function() {
			if ($(this).val() == 'click_by_user') {
				$('div.relation-outbound-schedule-open').slideUp('slow');
			} else {
				$('div.relation-outbound-schedule-open').slideDown('slow');
			}
		});

		$('#occurs_time_inbound').on('change', function() {
			if ($(this).val() == 'daily') {
				$('#weekly_fields').slideUp('slow');
				$('#monthly_fields').slideUp('slow');
				$('#selectOccursMonthIn').hide();
				$('#selectOccursWeekIn').hide();
				$('#selectOccursDayIn').show();
			}

			if ($(this).val() == 'weekly') {
				$('#monthly_fields').slideUp('slow');
				$('#weekly_fields').slideDown('slow');
				$('#selectOccursMonthIn').hide();
				$('#selectOccursWeekIn').show();
				$('#selectOccursDayIn').hide();
			}

			if ($(this).val() == 'monthly') {
				$('#weekly_fields').slideUp('slow');
				$('#monthly_fields').slideDown('slow');
				$('#selectOccursMonthIn').show();
				$('#selectOccursWeekIn').hide();
				$('#selectOccursDayIn').hide();
			}
		});

		$('#occurs_time_outbound').on('change', function() {
			if ($(this).val() == 'daily') {
				$('#weekly_fields_outbound').slideUp('slow');
				$('#monthly_fields_outbound').slideUp('slow');
				$('#selectOccursMonthInOutbound').hide();
				$('#selectOccursWeekInOutbound').hide();
				$('#selectOccursDayInOutbound').show();
			}

			if ($(this).val() == 'weekly') {
				$('#monthly_fields_outbound').slideUp('slow');
				$('#weekly_fields_outbound').slideDown('slow');
				$('#selectOccursMonthInOutbound').hide();
				$('#selectOccursWeekInOutbound').show();
				$('#selectOccursDayInOutbound').hide();
			}

			if ($(this).val() == 'monthly') {
				$('#weekly_fields_outbound').slideUp('slow');
				$('#monthly_fields_outbound').slideDown('slow');
				$('#selectOccursMonthInOutbound').show();
				$('#selectOccursWeekInOutbound').hide();
				$('#selectOccursDayInOutbound').hide();
			}
		});

		$('input[name=inbound_monthly_day]').on('change', function() {
			if ($(this).val() == 'day') {
				$('#the_section').slideUp('slow');
				$('#day_txt_box').slideDown('slow');
			}

			if ($(this).val() == 'The') {
				$('#day_txt_box').slideUp('slow');
				$('#the_section').slideDown('slow');
			}
		});

		$('input[name=outbound_monthly_day]').on('change', function() {
			if ($(this).val() == 'day') {
				$('#the_section_outbound').slideUp('slow');
				$('#day_txt_box_outbound').slideDown('slow');
			}

			if ($(this).val() == 'The') {
				$('#day_txt_box_outbound').slideUp('slow');
				$('#the_section_outbound').slideDown('slow');
			}
		});

		$('input[name="duration_inbound_is_end_date"]').on('change', function() {
			if ($(this).val() == 'yes_end_date') {
				$('#duration_inbound_end_date').removeClass('hidden');
				var d = new Date(inbound_start_date);
				var month = d.getMonth() + 1;
				var day = d.getDate();
				var output = d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
				$('#duration_inbound_end_date').val(output);
				document.getElementById("duration_inbound_end_date").setAttribute("min", output);
			} else {
				$('#duration_inbound_end_date').addClass('hidden');
			}
		});

		$('input[name="duration_outbound_is_end_date"]').on('change', function() {
			if ($(this).val() == 'yes_end_date') {
				$('#duration_outbound_end_date').removeClass('hidden');
				var d = new Date(outbound_start_date);
				var month = d.getMonth() + 1;
				var day = d.getDate();
				var output = d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
				$('#duration_outbound_end_date').val(output);
				document.getElementById("duration_outbound_end_date").setAttribute("min", output);
			} else {
				$('#duration_outbound_end_date').addClass('hidden');
			}
		});

		$('input[name="daily_frequency_type_inbound"]').on('change', function() {
			if ($(this).val() == 'Occurs Once At') {
				$("#recursEveryDiv").hide();
				$("#startingEndingDiv").hide();
				$("#daily_frequency_once_time_inbound").show();
			} else {
				$("#daily_frequency_once_time_inbound").hide();
				$("#recursEveryDiv").show();
				$("#startingEndingDiv").show();
			}
		});
	
		$('#duration_inbound_start_date').on('change', function() {
			if ($('#duration_inbound_start_date').val() == "" || inbound_start_date == undefined) {
				var d = new Date();
				var month = d.getMonth() + 1;
				var day = d.getDate();
				var output = d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
				$('#duration_inbound_start_date').val(output);
				document.getElementById("duration_inbound_start_date").setAttribute("min", output);
			} else {
				document.getElementById("duration_inbound_start_date").setAttribute("min", inbound_start_date);
			}

			var d = new Date(inbound_start_date);
			var month = d.getMonth() + 1;
			var day = d.getDate();
			var output = d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
			$('#duration_inbound_end_date').val(output);
			document.getElementById("duration_inbound_end_date").setAttribute("min", output);
		});

		$('#duration_outbound_start_date').on('change', function() {
			if ($('#duration_outbound_start_date').val() == "" || outbound_start_date == undefined) {
				var d = new Date();
				var month = d.getMonth() + 1;
				var day = d.getDate();
				var output = d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
				$('#duration_outbound_start_date').val(output);
				document.getElementById("duration_outbound_start_date").setAttribute("min", output);
			} else {
				document.getElementById("duration_outbound_start_date").setAttribute("min", outbound_start_date);
			}

			var d = new Date(outbound_start_date);
			var month = d.getMonth() + 1;
			var day = d.getDate();
			var output = d.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
			$('#duration_outbound_end_date').val(output);
			document.getElementById("duration_outbound_end_date").setAttribute("min", output);
		});

		$('input[name="daily_frequency_type_outbound"]').on('change', function() {
			if ($(this).val() == 'Occurs Once At') {
				$("#recursEveryDivOutbound").hide();
				$("#startingEndingDivOutbound").hide();
				$("#daily_frequency_once_time_outbound").show();
			} else {
				$("#daily_frequency_once_time_outbound").hide();
				$("#recursEveryDivOutbound").show();
				$("#startingEndingDivOutbound").show();
			}
		});

		$('input[name=schedule_type_inbound]').on('change', function() {
			if ($(this).val() == 'Recurring') {
				$('#inbound-data-one-time').hide();
				$('#inbound-data-recurring').show();
			} else {
				$('#inbound-data-one-time').show();
				$('#inbound-data-recurring').hide();
			}
		});

		$('input[name=schedule_type_outbound]').on('change', function() {
			if ($(this).val() == 'Recurring') {
				$('#outbound-data-one-time').hide();
				$('#outbound-data-recurring').show();
			} else {
				$('#outbound-data-one-time').show();
				$('#outbound-data-recurring').hide();
			}
		});
	}

	$('#conntest').on('click', function() {
		var host = $('#ftp_server_link').val();
		var user = $('#login_name').val();
		var password = $('#password').val();
		var port = $('#port').val();
		var folderpath = $('#folderpath').val();
		var isValid = $('#frm-save-inbound').valid();
		if (isValid) {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({'display':'block'});

			$.ajax({
				url: '/inbound/testFtp',
				method: 'post',
				dataType: 'json',
				data: {host:host, user:user, password:password, port:port, folderpath:folderpath},
				success: function(response) {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
					if (response.status == 1) {
						$('#conn-alert').html(response.message);
						$('#conn-alert').removeClass('text-success');
						$('#conn-alert').removeClass('text-danger');
						$('#conn-alert').addClass('text-success');
						$('#conn-alert').show();
					} else {
						$('#conn-alert').html(response.message);
						$('#conn-alert').removeClass('text-success');
						$('#conn-alert').removeClass('text-danger');
						$('#conn-alert').addClass('text-danger');
						$('#conn-alert').show();
					}
				}
			});
		}
	});

	// Vertical Wizard
	// --------------------------------------------------------------------
	if (typeof verticalWizard !== undefined && verticalWizard !== null) {
		var verticalStepper = new Stepper(verticalWizard, {
			linear: false
		});

		$(verticalWizard)
		.find('.btn-next')
		.on('click', function () {
			verticalStepper.next();
		});

		$(verticalWizard)
		.find('.btn-prev')
		.on('click', function () {
			verticalStepper.previous();
		});

		$(verticalWizard)
		.find('.btn-submit')
		.on('click', function () {
			swal({
				title: "Success!",
				text: "Schedule Setting Saved Successfully",
				type: "success",
				timer: 1200
			});
		});
	}

	// Modern Wizard
	// --------------------------------------------------------------------
	if (typeof modernWizard !== undefined && modernWizard !== null) {
		var modernStepper = new Stepper(modernWizard, {
			linear: false
		});
		$(modernWizard)
		.find('.btn-next')
		.on('click', function () {
			modernStepper.next();
		});

		$(modernWizard)
		.find('.btn-prev')
		.on('click', function () {
			modernStepper.previous();
		});

		$(modernWizard)
		.find('.btn-submit')
		.on('click', function () {
			swal({
				title: "Success!",
				text: "Schedule Setting Saved Successfully",
				type: "success",
				timer: 1200
			});
		});
	}

	// Modern Vertical Wizard
	// --------------------------------------------------------------------
	if (typeof modernVerticalWizard !== undefined && modernVerticalWizard !== null) {
		var modernVerticalStepper = new Stepper(modernVerticalWizard, {
			linear: false
		});

		$(modernVerticalWizard)
		.find('.btn-next')
		.on('click', function () {
			modernVerticalStepper.next();
		});

		$(modernVerticalWizard)
		.find('.btn-prev')
		.on('click', function () {
			modernVerticalStepper.previous();
		});

		$(modernVerticalWizard)
		.find('.btn-submit')
		.on('click', function () {
			alert('Submitted..!!');
		});
	}

	$('body').on('change', 'input:radio[name=sync_type]', function() {
		$('.sync_confige_tabs').hide();
		$('#api_options').hide();
		$('#api_ddep_api_input_method').hide();
		$('#api_ddep_api_input_parameter').hide();

		if (this.value == 'FTP' || this.value == 'SFTP') {
			$('#ftpInDiv').show();
		}

		if (this.value == 'API') {
			$('#apiInUrlDiv').show();
			$('#api_options').show();
		}
	});

	$('body').on('change', 'input:radio[name=api_type]', function() {
		if (this.value == 'User_API') {
			$('#api_user_api_input').show();
			$('#api_ddep_api_input').hide();
		}

		if (this.value == 'DDEP_API') {
			$('#api_ddep_api_input').show();
			$('#api_user_api_input').hide();
		}
	});

	$('body').on('change', 'select[name=ddep_api_auth_type]', function() {
		$('.authorization_api_key').hide();

		if (this.value == 'API_Key') {
			$('.authorization_api_key').css('display', 'flex');
		}
	});

	$('body').on('keypress', '#ddep_api_key_subscription_description, #ddep_api_key_custom_description', function (e) {
		var foo = $(this).val();
		if (foo.length >= 200) {
			e.preventDefault();
			return false;
		}
		return true;
	});

	$('body').on('keypress', '#ddep_api_key_custom_key', function (e) {
		var foo = $(this).val();
		if (foo.length >= 40) {
			e.preventDefault();
			return false;
		}
		return true;
	});

	$('body').on('click', '#ddep_api_key_generate_subscription_key_btn', function() {
		$('.overlay, body').removeClass('loaded');
		$('.overlay').css({'display':'block'});

		var description = $('#ddep_api_key_subscription_description').val();
		var isError = 0;
		if (description == '') {
			$('.error.ddep_api_key_subscription_description_error').show();
			isError = 1;
		}

		if (isError == 1) {
			$('.overlay, body').addClass('loaded');
			$('.overlay').css({'display':'none'});
			return false;
		}

		var authorizationApiKeyArrayObj = {};
		authorizationApiKeyArrayObj['Type'] = 'Auto Generated';
		authorizationApiKeyArrayObj['Key'] = '';
		authorizationApiKeyArrayObj['Description'] = description;

		$.ajax({
			url: '/generatekey',
			method: 'POST',
			dataType: 'json',
			data: authorizationApiKeyArrayObj,
			header: {
				"content-type": 'application/json'
			},
			success: function(response) {
				authorizationApiKeyArrayObj['Key'] = response.data.key;
				authorizationApiKeyArrayObj['date'] = response.data.date;

				var subscriptionRow = '';
				subscriptionRow += '<div class="row col-12 authorization_api_keys_table_body"><div class="col-md-2">Auto Generated</div><div class="col-md-6">' + response.data.key + '</div><div class="col-md-4">' + description + '</div></div>';
				$('#api_ddep_api_input .authorization_api_keys_table').append(subscriptionRow);

				authorizationApiKeyArray.push(authorizationApiKeyArrayObj);

				$('.authorization_api_key, .authorization_api_keys_table').show();
				$('#ddep_api_key_subscription_description').val('');
				$('.overlay, body').addClass('loaded');
				$('.overlay').css({'display':'none'});
			},
			error: function(textStatus, error) {
				if (textStatus.responseJSON.status == 404) {
					window.location.href = "/404";
				} else {
					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
					swal({
						title: "Error!",
						text: textStatus.responseJSON.message,
						type: "error",
						timer: 1200
					});
					return false;
				}
			}
		});
	});

	$('body').on('click', '#ddep_api_key_generate_custom_key_btn', function() {
		var key = $('#ddep_api_key_custom_key').val();
		var description = $('#ddep_api_key_custom_description').val();
		var isError = 0;
		if (key == '') {
			$('.error.ddep_api_key_custom_key_error').show();
			isError = 1;
		}
		if (description == '') {
			$('.error.ddep_api_key_custom_description_error').show();
			isError = 1;
		}
		if (isError == 1) {
			return false;
		}

		var authorizationApiKeyArrayObj = {};
		authorizationApiKeyArrayObj['Type'] = 'Custom Key';
		authorizationApiKeyArrayObj['Key'] = key;
		authorizationApiKeyArrayObj['Description'] = description;
		authorizationApiKeyArrayObj['date'] = new Date();

		var subscriptionRow = '';
		subscriptionRow += '<div class="row col-12 authorization_api_keys_table_body"><div class="col-md-2">Custom Key</div><div class="col-md-6">' + key + '</div><div class="col-md-4">' + description + '</div></div>';
		$('#api_ddep_api_input .authorization_api_keys_table').append(subscriptionRow);

		authorizationApiKeyArray.push(authorizationApiKeyArrayObj);

		$('.authorization_api_key, .authorization_api_keys_table').show();
		$('#ddep_api_key_custom_key').val('');
		$('#ddep_api_key_custom_description').val('');
	});

	var eitem_id = $('#Item_id').val();
	if (eitem_id != '') {
		$('.step-trigger').removeAttr('disabled');
		$('body').on('click', '.bs-stepper-header .step', function(){
			var dataID = $(this).attr('data-target');
			var stepper = new Stepper(document.querySelector('.bs-stepper'));
			if (dataID == '#create-item') {
				stepper.to(1);
			} else if (dataID == '#inbound-step') {
				stepper.to(2);
			} else if (dataID == '#inbound-filter-step') {
				stepper.to(3);
			} else if (dataID == '#outbound-step') {
				stepper.to(4);
			} else if (dataID == '#mapping-step') {
				stepper.to(5);
			} else if (dataID == '#outbound-filter-step') {
				stepper.to(6);
			} else if (dataID == '#outbound-mapping-step') {
				stepper.to(7);
			} else if (dataID == '#schedule-step') {
				stepper.to(8);
			}
			$('.step-trigger').removeAttr('disabled');
		});
		var item_id = $('#Item_id').val();
		editalltabs(item_id);
	}

	var outboundSpecifyHeadersModal = document.getElementById("outbound-specify-headers-modal");
	var outboundSpecifyHeadersPopupBtn = document.getElementById("outbound-specify-headers-popup-btn");
	var outboundSpecifyHeadersModalClose = document.getElementById("outbound-specify-headers-modal-close");
	outboundSpecifyHeadersPopupBtn.onclick = function() {
		const headerId = outboundSpecifyHeadersPopupBtn.getAttribute("data-id");
		$('#outbound_specify_headers_id').val(headerId);
		if (headerId in outboundSpecifyHeadersObj) {
			const outboundSpecifyHeadersArray = outboundSpecifyHeadersObj[headerId];
			let outboundSpecifyHeadersHtml = '';
			for (var i = 0; i < outboundSpecifyHeadersArray.length; i++) {
				const status = (outboundSpecifyHeadersArray[i]?.status == "true") ? "checked" : "";
				const key = outboundSpecifyHeadersArray[i]?.key || "";
				const value = outboundSpecifyHeadersArray[i]?.value || "";
				const description = outboundSpecifyHeadersArray[i]?.description || "";
				var newRow = "<tr>";
				var cols = "";
				cols += '<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound_specify_headers_status" id="outbound_specify_headers_status_' + i + '" class="custom-control-input" ' + status + ' /><label class="custom-control-label" for="outbound_specify_headers_status_' + i + '"></label></div></td>';
				cols += '<td class="col-sm-3"><input type="text" name="outbound_specify_headers[][key]" class="form-control border-0" data-class="outbound_specify_headers_" id="outbound_specify_headers_key_' + i + '" value="' + key + '" /></td>';
				cols += '<td class="col-sm-4"><input type="text" name="outbound_specify_headers[][value]" class="form-control border-0" data-class="outbound_specify_headers_" id="outbound_specify_headers_value_' + i + '" value="' + value + '" /></td>';
				cols += '<td class="col-sm-3"><input type="text" name="outbound_specify_headers[][description]" class="form-control border-0" data-class="outbound_specify_headers_" id="description_' + i + '" value="' + description + '" /></td>';
				cols += '<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-specify-headers-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
				newRow += cols;
				newRow += "</tr>";
				outboundSpecifyHeadersRowCounter = i
				outboundSpecifyHeadersHtml += newRow;
			}

			$("table.outbound-specify-headers-table tbody").html(outboundSpecifyHeadersHtml);
		} else {
			var newRow = "<tr>";
			var cols = "";
			cols += '<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound_specify_headers_status" id="outbound_specify_headers_status_0" class="custom-control-input" checked /><label class="custom-control-label" for="outbound_specify_headers_status_0"></label></div></td>';
			cols += '<td class="col-sm-3"><input type="text" name="outbound_specify_headers[][key]" class="form-control border-0" data-class="outbound_specify_headers_" id="outbound_specify_headers_key_0" /></td>';
			cols += '<td class="col-sm-4"><input type="text" name="outbound_specify_headers[][value]" class="form-control border-0" data-class="outbound_specify_headers_" id="outbound_specify_headers_value_0" /></td>';
			cols += '<td class="col-sm-3"><input type="text" name="outbound_specify_headers[][description]" class="form-control border-0" data-class="outbound_specify_headers_" id="description_0" /></td>';
			cols += '<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-specify-headers-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
			newRow += cols;
			newRow += "</tr>";
			$("table.outbound-specify-headers-table tbody").html(newRow);
		}
		outboundSpecifyHeadersModal.style.display = "flex";
	}
	outboundSpecifyHeadersModalClose.onclick = function() {
		outboundSpecifyHeadersModal.style.display = "none";
	}
	window.onclick = function(event) {
		if (event.target == outboundSpecifyHeadersModal) {
			outboundSpecifyHeadersModal.style.display = "none";
		}
	}

	var outboundValidationModal = document.getElementById("outbound-validation-modal");
	var outboundValidationPopupBtn = document.getElementById("outbound-validation-popup-btn");
	var outboundValidationModalClose = document.getElementById("outbound-validation-modal-close");
	outboundValidationPopupBtn.onclick = function() {
		outboundValidationModal.style.display = "flex";
	}
	outboundValidationModalClose.onclick = function() {
		outboundValidationModal.style.display = "none";
	}
	window.onclick = function(event) {
		if (event.target == outboundValidationModal) {
			outboundValidationModal.style.display = "none";
		}
	}

	var allInboundPropertiesModal = document.getElementById("all-inbound-properties-modal");
	var allInboundPropertiesPopupBtn = document.getElementById("all-inbound-properties-btn");
	var allInboundPropertiesModalClose = document.getElementById("all-inbound-properties-modal-close");
	allInboundPropertiesPopupBtn.onclick = function() {
		let itemPropertiesDataTable = "";
		for (var i = 0; i < itemProperties.length; i++) {
			itemPropertiesDataTable += "<table class='table table-bordered'>";

			if (itemProperties[i].general != undefined) {
				const itemName = (itemProperties[i].general.itemName != undefined) ? itemProperties[i].general.itemName : "";
				itemPropertiesDataTable += "<tr><td colspan='2'><strong>General</strong></td></tr>";
				itemPropertiesDataTable += "<tr><td>Item</td><td>" + itemName + "</td></tr>";
			}

			if (itemProperties[i].display != undefined) {
				const displayValue = (itemProperties[i].display.value != undefined) ? itemProperties[i].display.value : "";
				const defaultValue = (itemProperties[i].display.defaultValue != undefined) ? itemProperties[i].display.defaultValue : "";
				itemPropertiesDataTable += "<tr><td colspan='2'><strong>Display</strong></td></tr>";
				itemPropertiesDataTable += "<tr><td>Value</td><td>" + displayValue + "</td></tr>";
				itemPropertiesDataTable += "<tr><td>Default Value</td><td>" + defaultValue + "</td></tr>";
			}

			if (itemProperties[i].validation != undefined) {
				const isRequired = (itemProperties[i].validation.isRequired != undefined) ? itemProperties[i].validation.isRequired : "FALSE";
				const valueMustbe = (itemProperties[i].validation.valueMustbe != undefined) ? itemProperties[i].validation.valueMustbe : "ANY";
				itemPropertiesDataTable += "<tr><td colspan='2'><strong>Validation</strong></td></tr>";
				itemPropertiesDataTable += "<tr><td>isRequired</td><td>" + isRequired + "</td></tr>";
				itemPropertiesDataTable += "<tr><td>valueMustbe</td><td>" + valueMustbe + "</td></tr>";

				itemPropertiesDataTable += "<tr><td colspan='2'><strong>Validation Additional Rules</strong></td></tr><tr><td colspan='2'><table class='table table-bordered'><thead><tr><td>Logical Operation</td><td>Original Value</td><td>Comparison operations</td><td>Column Value</td><td>Then</td><td>Formula/Alerts</td></tr></thead><tbody>";

				if (itemProperties[i].validation.additonal_rules != undefined) {
					const additonal_rules = itemProperties[i].validation.additonal_rules;
					for (var j = 0; j < additonal_rules.length; j++) {
						itemPropertiesDataTable += "<tr><td>" + additonal_rules[j].logical + "</td><td>" + additonal_rules[j].original + "</td><td>" + additonal_rules[j].operations + "</td><td>" + additonal_rules[j].column + "</td><td>" + additonal_rules[j].then + "</td><td>" + additonal_rules[j].formula + "</td></tr>";
					}
				}

				itemPropertiesDataTable += "</tbody></table></td></tr>";
			}

			if (itemProperties[i].format != undefined) {
				const trim = (itemProperties[i].format.trim != undefined) ? itemProperties[i].format.trim : "FALSE";
				const enableRounding = (itemProperties[i].format.enableRounding != undefined) ? itemProperties[i].format.enableRounding : "FALSE";
				const enabeDecimal = (itemProperties[i].format.enabeDecimal != undefined) ? itemProperties[i].format.enabeDecimal : "FALSE";
				const decimal = (itemProperties[i].format.decimal != undefined) ? itemProperties[i].format.decimal : "2";
				itemPropertiesDataTable += "<tr><td colspan='2'><strong>Validation</strong></td></tr>";
				itemPropertiesDataTable += "<tr><td>trim</td><td>" + trim + "</td></tr>";
				itemPropertiesDataTable += "<tr><td>enableRounding</td><td>" + enableRounding + "</td></tr>";
				itemPropertiesDataTable += "<tr><td>enabeDecimal</td><td>" + enabeDecimal + "</td></tr>";
				itemPropertiesDataTable += "<tr><td>decimal</td><td>" + decimal + "</td></tr>";

				itemPropertiesDataTable += "<tr><td colspan='2'><strong>Format Additional Rules</strong></td></tr><tr><td colspan='2'><table class='table table-bordered'><thead><tr><td>Options</td><td></td><td></td></tr></thead><tbody>";

				if (itemProperties[i].format.additonal_rules != undefined) {
					const additonal_rules = itemProperties[i].format.additonal_rules;
					for (var l = 0; l < additonal_rules.length; l++) {
						itemPropertiesDataTable += "<tr><td>" + additonal_rules[l].name + "</td><td>" + additonal_rules[l].formulato + "</td><td>" + additonal_rules[l].formulatonew + "</td></tr>";
					}
				}

				itemPropertiesDataTable += "</tbody></table></td></tr>";
			}

			itemPropertiesDataTable += "</table>";
		}

		$("#all-inbound-properties-modal .properties-data").html(itemPropertiesDataTable);
		allInboundPropertiesModal.style.display = "flex";
	}
	allInboundPropertiesModalClose.onclick = function() {
		allInboundPropertiesModal.style.display = "none";
	}
	window.onclick = function(event) {
		if (event.target == allInboundPropertiesModal) {
			allInboundPropertiesModal.style.display = "none";
		}
	}

	var allOutboundPropertiesModal = document.getElementById("all-outbound-properties-modal");
	var allOutboundPropertiesPopupBtn = document.getElementById("all-outbound-properties-btn");
	var allOutboundPropertiesModalClose = document.getElementById("all-outbound-properties-modal-close");
	allOutboundPropertiesPopupBtn.onclick = function() {
		let itemPropertiesOutboundDataTable = "";
		for (var i = 0; i < itemPropertiesOutbound.length; i++) {
			itemPropertiesOutboundDataTable += "<table class='table table-bordered'>";

			if (itemPropertiesOutbound[i].general != undefined) {
				const itemName = (itemPropertiesOutbound[i].general.itemName != undefined) ? itemPropertiesOutbound[i].general.itemName : "";
				itemPropertiesOutboundDataTable += "<tr><td colspan='2'><strong>General</strong></td></tr>";
				itemPropertiesOutboundDataTable += "<tr><td>Item</td><td>" + itemName + "</td></tr>";
			}

			if (itemPropertiesOutbound[i].display != undefined) {
				const displayValue = (itemPropertiesOutbound[i].display.value != undefined) ? itemPropertiesOutbound[i].display.value : "";
				const defaultValue = (itemPropertiesOutbound[i].display.defaultValue != undefined) ? itemPropertiesOutbound[i].display.defaultValue : "";
				itemPropertiesOutboundDataTable += "<tr><td colspan='2'><strong>Display</strong></td></tr>";
				itemPropertiesOutboundDataTable += "<tr><td>Value</td><td>" + displayValue + "</td></tr>";
				itemPropertiesOutboundDataTable += "<tr><td>Default Value</td><td>" + defaultValue + "</td></tr>";
			}

			if (itemPropertiesOutbound[i].validation != undefined) {
				const isRequired = (itemPropertiesOutbound[i].validation.isRequired != undefined) ? itemPropertiesOutbound[i].validation.isRequired : "FALSE";
				const valueMustbe = (itemPropertiesOutbound[i].validation.valueMustbe != undefined) ? itemPropertiesOutbound[i].validation.valueMustbe : "ANY";
				itemPropertiesOutboundDataTable += "<tr><td colspan='2'><strong>Validation</strong></td></tr>";
				itemPropertiesOutboundDataTable += "<tr><td>isRequired</td><td>" + isRequired + "</td></tr>";
				itemPropertiesOutboundDataTable += "<tr><td>valueMustbe</td><td>" + valueMustbe + "</td></tr>";

				itemPropertiesOutboundDataTable += "<tr><td colspan='2'><strong>Validation Additional Rules</strong></td></tr><tr><td colspan='2'><table class='table table-bordered'><thead><tr><td>Logical Operation</td><td>Original Value</td><td>Comparison operations</td><td>Column Value</td><td>Then</td><td>Formula/Alerts</td></tr></thead><tbody>";

				if (itemPropertiesOutbound[i].validation.additonal_rules != undefined) {
					const additonal_rules = itemPropertiesOutbound[i].validation.additonal_rules;
					for (let j = 0; j < additonal_rules.length; j++) {
						itemPropertiesOutboundDataTable += "<tr><td>" + additonal_rules[j].logical + "</td><td>" + additonal_rules[j].original + "</td><td>" + additonal_rules[j].operations + "</td><td>" + additonal_rules[j].column + "</td><td>" + additonal_rules[j].then + "</td><td>" + additonal_rules[j].formula + "</td></tr>";
					}
				}

				itemPropertiesOutboundDataTable += "</tbody></table></td></tr>";
			}

			if (itemPropertiesOutbound[i].format != undefined) {
				const trim = (itemPropertiesOutbound[i].format.trim != undefined) ? itemPropertiesOutbound[i].format.trim : "FALSE";
				const enableRounding = (itemPropertiesOutbound[i].format.enableRounding != undefined) ? itemPropertiesOutbound[i].format.enableRounding : "FALSE";
				const enabeDecimal = (itemPropertiesOutbound[i].format.enabeDecimal != undefined) ? itemPropertiesOutbound[i].format.enabeDecimal : "FALSE";
				const decimal = (itemPropertiesOutbound[i].format.decimal != undefined) ? itemPropertiesOutbound[i].format.decimal : "2";
				itemPropertiesOutboundDataTable += "<tr><td colspan='2'><strong>Validation</strong></td></tr>";
				itemPropertiesOutboundDataTable += "<tr><td>trim</td><td>" + trim + "</td></tr>";
				itemPropertiesOutboundDataTable += "<tr><td>enableRounding</td><td>" + enableRounding + "</td></tr>";
				itemPropertiesOutboundDataTable += "<tr><td>enabeDecimal</td><td>" + enabeDecimal + "</td></tr>";
				itemPropertiesOutboundDataTable += "<tr><td>decimal</td><td>" + decimal + "</td></tr>";

				itemPropertiesOutboundDataTable += "<tr><td colspan='2'><strong>Format Additional Rules</strong></td></tr><tr><td colspan='2'><table class='table table-bordered'><thead><tr><td>Options</td><td></td><td></td></tr></thead><tbody>";

				if (itemPropertiesOutbound[i].format.additonal_rules != undefined) {
					const additonal_rules = itemPropertiesOutbound[i].format.additonal_rules;
					for (let l = 0; l < additonal_rules.length; l++) {
						itemPropertiesOutboundDataTable += "<tr><td>" + additonal_rules[l].name + "</td><td>" + additonal_rules[l].formulato + "</td><td>" + additonal_rules[l].formulatonew + "</td></tr>";
					}
				}

				itemPropertiesOutboundDataTable += "</tbody></table></td></tr>";
			}

			itemPropertiesOutboundDataTable += "</table>";
		}

		$("#all-outbound-properties-modal .properties-data").html(itemPropertiesOutboundDataTable);
		allOutboundPropertiesModal.style.display = "flex";
	}
	allOutboundPropertiesModalClose.onclick = function() {
		allOutboundPropertiesModal.style.display = "none";
	}
	window.onclick = function(event) {
		if (event.target == allOutboundPropertiesModal) {
			allOutboundPropertiesModal.style.display = "none";
		}
	}

	var propsValidationAdditionalRulesModalBtn = document.getElementById("props-validation-additional-rules-modal-btn");
	var propsValidationAdditionalRulesPopupBtn = document.getElementById("props-validation-additional-rules-popup-btn");
	var propsValidationAdditionalRulesModalClose = document.getElementById("props-validation-additional-rules-modal-close");
	propsValidationAdditionalRulesPopupBtn.onclick = function() {
		propsValidationAdditionalRulesModalBtn.style.display = "flex";
	}
	propsValidationAdditionalRulesModalClose.onclick = function() {
		propsValidationAdditionalRulesModalBtn.style.display = "none";
	}
	window.onclick = function(event) {
		if (event.target == propsValidationAdditionalRulesModalBtn) {
			propsValidationAdditionalRulesModalBtn.style.display = "none";
		}
	}

	var propsOutboundValidationAdditionalRulesModalBtn = document.getElementById("props-outbound-validation-additional-rules-modal-btn");
	var propsOutboundValidationAdditionalRulesPopupBtn = document.getElementById("props-outbound-validation-additional-rules-popup-btn");
	var propsOutboundValidationAdditionalRulesModalClose = document.getElementById("props-outbound-validation-additional-rules-modal-close");
	propsOutboundValidationAdditionalRulesPopupBtn.onclick = function() {
		propsOutboundValidationAdditionalRulesModalBtn.style.display = "flex";
	}
	propsOutboundValidationAdditionalRulesModalClose.onclick = function() {
		propsOutboundValidationAdditionalRulesModalBtn.style.display = "none";
	}
	window.onclick = function(event) {
		if (event.target == propsOutboundValidationAdditionalRulesModalBtn) {
			propsOutboundValidationAdditionalRulesModalBtn.style.display = "none";
		}
	}

	var propsFormatAdditionalRulesModalBtn = document.getElementById("props-format-additional-rules-modal-btn");
	var propsFormatAdditionalRulesPopupBtn = document.getElementById("props-format-additional-rules-popup-btn");
	var propsFormatAdditionalRulesModalClose = document.getElementById("props-format-additional-rules-modal-close");
	propsFormatAdditionalRulesPopupBtn.onclick = function() {
		propsFormatAdditionalRulesModalBtn.style.display = "flex";
	}
	propsFormatAdditionalRulesModalClose.onclick = function() {
		propsFormatAdditionalRulesModalBtn.style.display = "none";
	}
	window.onclick = function(event) {
		if (event.target == propsFormatAdditionalRulesModalBtn) {
			propsFormatAdditionalRulesModalBtn.style.display = "none";
		}
	}

	var propsOutboundFormatAdditionalRulesModalBtn = document.getElementById("props-outbound-format-additional-rules-modal-btn");
	var propsOutboundFormatAdditionalRulesPopupBtn = document.getElementById("props-outbound-format-additional-rules-popup-btn");
	var propsOutboundFormatAdditionalRulesModalClose = document.getElementById("props-outbound-format-additional-rules-modal-close");
	propsOutboundFormatAdditionalRulesPopupBtn.onclick = function() {
		propsOutboundFormatAdditionalRulesModalBtn.style.display = "flex";
	}
	propsOutboundFormatAdditionalRulesModalClose.onclick = function() {
		propsOutboundFormatAdditionalRulesModalBtn.style.display = "none";
	}
	window.onclick = function(event) {
		if (event.target == propsOutboundFormatAdditionalRulesModalBtn) {
			propsOutboundFormatAdditionalRulesModalBtn.style.display = "none";
		}
	}

	$("body").on("click", "#outbound-specify-headers-btn-add-row", function () {
		var newRow = "<tr>";
		var cols = "";
		cols += '<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound_specify_headers_status" id="outbound_specify_headers_status_' + outboundSpecifyHeadersRowCounter + '" class="custom-control-input" checked /><label class="custom-control-label" for="outbound_specify_headers_status_' + outboundSpecifyHeadersRowCounter + '"></label></div></td>';
		cols += '<td class="col-sm-3"><input type="text" name="outbound_specify_headers[][key]" class="form-control border-0" data-class="outbound_specify_headers_" id="outbound_specify_headers_key_' + outboundSpecifyHeadersRowCounter + '" /></td>';
		cols += '<td class="col-sm-4"><input type="text" name="outbound_specify_headers[][value]" class="form-control border-0" data-class="outbound_specify_headers_" id="outbound_specify_headers_value_' + outboundSpecifyHeadersRowCounter + '" /></td>';
		cols += '<td class="col-sm-3"><input type="text" name="outbound_specify_headers[][description]" class="form-control border-0" data-class="outbound_specify_headers_" id="description_' + outboundSpecifyHeadersRowCounter + '" /></td>';
		cols += '<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-specify-headers-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
		newRow += cols;
		newRow += "</tr>";
		$("table.outbound-specify-headers-table tbody").append(newRow);
		outboundSpecifyHeadersRowCounter++;
	});

	$("body table.outbound-specify-headers-table").on("click", ".outbound-specify-headers-btn-del", function (event) {
		$(this).closest("tr").remove();
	});

	$("body").on("click", "#outbound-global-headers-btn-add-row", function () {
		var newRow = "<tr>";
		var cols = "";
		cols += '<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound_global_headers_status" id="outbound_global_headers_status_' + outboundGlobalHeadersRowCounter + '" class="custom-control-input" checked /><label class="custom-control-label" for="outbound_global_headers_status_' + outboundGlobalHeadersRowCounter + '"></label></div></td>';
		cols += '<td class="col-sm-3"><input type="text" name="outbound_global_headers[][key]" class="form-control border-0" data-class="outbound_global_headers_" id="outbound_global_headers_key_' + outboundGlobalHeadersRowCounter + '" /></td>';
		cols += '<td class="col-sm-4"><input type="text" name="outbound_global_headers[][value]" class="form-control border-0" data-class="outbound_global_headers_" id="outbound_global_headers_value_' + outboundGlobalHeadersRowCounter + '" /></td>';
		cols += '<td class="col-sm-3"><input type="text" name="outbound_global_headers[][description]" class="form-control border-0" data-class="outbound_global_headers_" id="description_' + outboundGlobalHeadersRowCounter + '" /></td>';
		cols += '<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-global-headers-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
		newRow += cols;
		newRow += "</tr>";
		$("table.outbound-global-headers-table tbody").append(newRow);
		outboundGlobalHeadersRowCounter++;
	});

	$("body table.outbound-global-headers-table").on("click", ".outbound-global-headers-btn-del", function (event) {
		$(this).closest("tr").remove();
	});

	$("body").on("click", "#outbound-validation-rules-btn-add-row", function () {
		var newRow = "<tr>";
		var cols = "";
		cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="validations[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
		cols += '<td class="col-sm-3 autocomplete"><input type="text" name="validations[][original]" class="form-control border-0 autocompletevalidation" data-class="outbound_validation_" id="original_' + validationRowCounter + '"/></td>';
		cols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="validations[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
		cols += '<td class="col-sm-2 autocomplete"><input type="text" name="validations[][column]" class="form-control border-0 autocompletevalidation" data-class="outbound_validation_" id="column_' + validationRowCounter + '"/></td>';
		cols += '<td class="col-sm-2"><select class="select-dropdown form-control form-control-lg" name="validations[][then]"><option value="STOP">STOP</option></select></td>';
		cols += '<td class="col-sm-2 autocomplete"><input type="text" name="validations[][formula]" class="form-control border-0 autocompletevalidation" data-class="outbound_validation_" id="validformula_' + validationRowCounter + '"/></td>';
		cols += '<td class="col-sm-2"><a href="javascript:void(0);" type="button" class="outbound-validation-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
		newRow += cols;
		newRow += "</tr>";
		$("table.outbound-validation-rules-table tbody").append(newRow);
		validationRowCounter++;
	});

	$("body table.outbound-validation-rules-table").on("click", ".outbound-validation-rules-btn-del", function (event) {
		$(this).closest("tr").remove();
	});

	$("body").on("click", "#prop-validation-additional-rules-btn-add-row", function () {
		var newRow = "<tr>";
		var cols = "";
		cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
		cols += '<td class="col-sm-3 autocomplete"><input type="text" name="propsvalidations[][original]" class="form-control border-0 autocompleteformula" id="proporiginal_' + propsValidationRowCounter + '"/></td>';
		cols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
		cols += '<td class="col-sm-2 autocomplete"><input type="text" name="propsvalidations[][column]" class="form-control border-0 autocompleteformula" id="propcolumn_' + propsValidationRowCounter + '"/></td>';
		cols += '<td class="col-sm-2"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][then]"><option value="STOP">STOP</option></select></td>';
		cols += '<td class="col-sm-2 autocomplete"><input type="text" name="propsvalidations[][formula]" class="form-control border-0 autocompleteformula" id="propformula_' + propsValidationRowCounter + '"/></td>';
		cols += '<td class="col-sm-2"><a href="javascript:void(0);" type="button" class="prop-validation-additional-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
		newRow += cols;
		newRow += "</tr>";
		$("table.prop-validation-additional-rules-table tbody").append(newRow);
		propsValidationRowCounter++;
	});

	$("body table.prop-validation-additional-rules-table").on("click", ".prop-validation-additional-rules-btn-del", function (event) {
		$(this).closest("tr").remove();
	});

	$("body").on("click", "#prop-outbound-validation-additional-rules-btn-add-row", function () {
		var newRow = "<tr>";
		var cols = "";
		cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
		cols += '<td class="col-sm-3 autocomplete"><input type="text" name="propsvalidations[][original]" class="form-control border-0 autocompleteformulaoutbound" id="propoutboundoriginal_' + propsOutboundValidationRowCounter + '"/></td>';
		cols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
		cols += '<td class="col-sm-2 autocomplete"><input type="text" name="propsvalidations[][column]" class="form-control border-0 autocompleteformulaoutbound" id="propoutboundcolumn_' + propsOutboundValidationRowCounter + '"/></td>';
		cols += '<td class="col-sm-2"><select class="select-dropdown form-control form-control-lg" name="propsvalidations[][then]"><option value="STOP">STOP</option></select></td>';
		cols += '<td class="col-sm-2 autocomplete"><input type="text" name="propsvalidations[][formula]" class="form-control border-0 autocompleteformulaoutbound" id="propoutboundformula_' + propsOutboundValidationRowCounter + '"/></td>';
		cols += '<td class="col-sm-2"><a href="javascript:void(0);" type="button" class="prop-outbound-validation-additional-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
		newRow += cols;
		newRow += "</tr>";
		$("table.prop-outbound-validation-additional-rules-table tbody").append(newRow);
		propsOutboundValidationRowCounter++;
	});

	$("body table.prop-outbound-validation-additional-rules-table").on("click", ".prop-outbound-validation-additional-rules-btn-del", function (event) {
		$(this).closest("tr").remove();
	});

	$("body").on("change", ".format-additional-rules-name", function () {
		var trid = $(this).closest("tr").attr("id");
		var value = $(this).val();
		if (value == 'REPLACE' || value == 'SUBSTRING') {
			$('#' + trid + ' .prop-format-additional-rules-table-row-formulato input').show();
			$('#' + trid + ' .prop-format-additional-rules-table-row-formulato select').hide();
			$('#' + trid + ' .prop-format-additional-rules-table-row-formulatonew input').show();
		} else {
			$('#' + trid + ' .prop-format-additional-rules-table-row-formulatonew input').hide();
			if (value == 'TRIM' || value == 'LEFT TRIM' || value == 'RIGHT TRIM') {
				$('#' + trid + ' .prop-format-additional-rules-table-row-formulato input').hide();
				$('#' + trid + ' .prop-format-additional-rules-table-row-formulato select').show();
			} else {
				$('#' + trid + ' .prop-format-additional-rules-table-row-formulato input').show();
				$('#' + trid + ' .prop-format-additional-rules-table-row-formulato select').hide();
			}
		}
	});

	$("body").on("click", "#prop-format-additional-rules-btn-add-row", function () {
		var newRow = '<tr id="prop-format-additional-rules-table-row-' + propsFormatRowCounter + '">';
		var cols = '';
		cols += '<td class="col-sm-1 format-rules-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
		cols += '<td class="col-sm-3"><select class="select-dropdown form-control form-control-lg format-additional-rules-name" name="formatrules[][name]" id="format-additional-rules-name-' + propsFormatRowCounter + '"><option value="REPLACE">REPLACE</option><option value="SUBSTRING">SUBSTRING</option><option value="To DATE">To DATE</option><option value="TRIM">TRIM</option><option value="LEFT TRIM">LEFT TRIM</option><option value="RIGHT TRIM">RIGHT TRIM</option><option value="ADD WORDS ON THE BEGINING">ADD WORDS ON THE BEGINING</option><option value="ADD WORDS ON THE END">ADD WORDS ON THE END</option><option value="FORMULA TO">FORMULA TO</option></select></td>';
		cols += '<td class="col-sm-3 prop-format-additional-rules-table-row-formulato autocomplete"><input type="text" name="formatrules[][formulato]" class="form-control border-0 autocompleteformula" id="format-additional-rules-formulato-' + propsFormatRowCounter + '"/><select class="select-dropdown form-control form-control-lg" name="formatrules[][formulatodropdown]" id="format-additional-rules-formulatodropdown-' + propsFormatRowCounter + '" style="display: none;"><option value="FALSE">FALSE</option><option value="TRUE">TRUE</option></select></td>';
		cols += '<td class="col-sm-3 prop-format-additional-rules-table-row-formulatonew"><input type="text" name="formatrules[][formulatonew]" class="form-control border-0" id="format-additional-rules-formulatonew-' + propsFormatRowCounter + '"/></td>';
		cols += '<td class="col-sm-1"><a href="javascript:void(0);" type="button" class="prop-format-additional-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
		newRow += cols;
		newRow += '</tr>';
		$("table.prop-format-additional-rules-table tbody").append(newRow);
		propsFormatRowCounter++;
	});

	$("body table.prop-format-additional-rules-table").on("click", ".prop-format-additional-rules-btn-del", function (event) {
		$(this).closest("tr").remove();
	});

	$("body").on("click", "#prop-outbound-format-additional-rules-btn-add-row", function () {
		var newRow = '<tr id="prop-outbound-format-additional-rules-table-row-' + propsOutboundFormatRowCounter + '">';
		var cols = '';
		cols += '<td class="col-sm-1 format-rules-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-code font-medium-2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></td>';
		cols += '<td class="col-sm-3"><select class="select-dropdown form-control form-control-lg format-additional-rules-name" name="formatrules[][name]" id="format-outbound-additional-rules-name-' + propsOutboundFormatRowCounter + '"><option value="REPLACE">REPLACE</option><option value="SUBSTRING">SUBSTRING</option><option value="To DATE">To DATE</option><option value="TRIM">TRIM</option><option value="LEFT TRIM">LEFT TRIM</option><option value="RIGHT TRIM">RIGHT TRIM</option><option value="ADD WORDS ON THE BEGINING">ADD WORDS ON THE BEGINING</option><option value="ADD WORDS ON THE END">ADD WORDS ON THE END</option><option value="FORMULA TO">FORMULA TO</option></select></td>';
		cols += '<td class="col-sm-3 prop-format-additional-rules-table-row-formulato autocomplete"><input type="text" name="formatrules[][formulato]" class="form-control border-0 autocompleteformulaoutbound" id="format-outbound-additional-rules-formulato-' + propsOutboundFormatRowCounter + '"/><select class="select-dropdown form-control form-control-lg" name="formatrules[][formulatodropdown]" id="format-outbound-additional-rules-formulatodropdown-' + propsOutboundFormatRowCounter + '" style="display: none;"><option value="FALSE">FALSE</option><option value="TRUE">TRUE</option></select></td>';
		cols += '<td class="col-sm-3 prop-format-additional-rules-table-row-formulatonew"><input type="text" name="formatrules[][formulatonew]" class="form-control border-0" id="format-outbound-additional-rules-formulatonew-' + propsOutboundFormatRowCounter + '"/></td>';
		cols += '<td class="col-sm-1"><a href="javascript:void(0);" type="button" class="prop-outbound-format-additional-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
		newRow += cols;
		newRow += '</tr>';
		$("table.prop-outbound-format-additional-rules-table tbody").append(newRow);
		propsOutboundFormatRowCounter++;
	});

	$("body table.prop-outbound-format-additional-rules-table").on("click", ".prop-outbound-format-additional-rules-btn-del", function (event) {
		$(this).closest("tr").remove();
	});

	$("body").on("click", "#inbound-filter-btn-add-row", function () {
		var newRow = "<tr>";
		var cols = "";
		cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="inboundfilter[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
		cols += '<td class="col-sm-3 autocomplete"><input type="text" name="inboundfilter[][original]" class="form-control border-0 autocompleteinboundfilter" id="inboundfilteroriginal_' + inboundFilterCounter + '"/></td>';
		cols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="inboundfilter[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
		cols += '<td class="col-sm-2 autocomplete"><input type="text" name="inboundfilter[][column]" class="form-control border-0 autocompleteinboundfilter" id="inboundfiltercolumn_' + inboundFilterCounter + '"/></td>';
		cols += '<td class="col-sm-2"><a href="javascript:void(0);" type="button" class="inbound-filter-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
		newRow += cols;
		newRow += "</tr>";
		$("table.inbound-filter-table tbody").append(newRow);
		inboundFilterCounter++;
	});

	$("body table.inbound-filter-table").on("click", ".inbound-filter-btn-del", function (event) {
		$(this).closest("tr").remove();
	});

	$("body").on("click", "#outbound-filter-btn-add-row", function () {
		var newRow = "<tr>";
		var cols = "";
		cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="outboundfilter[][logical]"><option value="AND">AND</option><option value="OR">OR</option></select></td>';
		cols += '<td class="col-sm-3 autocomplete"><input type="text" name="outboundfilter[][original]" class="form-control border-0 autocompleteoutboundfilter" id="outboundfilteroriginal_' + outboundFilterCounter + '"/></td>';
		cols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="outboundfilter[][operations]"><option value="==">=</option><option value=">">></option><option value=">=">>=</option><option value="<"><</option><option value="<="><=</option><option value="<>"><></option><option value="Contains">Contains</option></select></td>';
		cols += '<td class="col-sm-2 autocomplete"><input type="text" name="outboundfilter[][column]" class="form-control border-0 autocompleteoutboundfilter" id="outboundfiltercolumn_' + outboundFilterCounter + '"/></td>';
		cols += '<td class="col-sm-2"><a href="javascript:void(0);" type="button" class="outbound-filter-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
		newRow += cols;
		newRow += "</tr>";
		$("table.outbound-filter-table tbody").append(newRow);
		outboundFilterCounter++;
	});

	$("body table.outbound-filter-table").on("click", ".outbound-filter-btn-del", function (event) {
		$(this).closest("tr").remove();
	});

	$("body").on("click", "#InboundDataBind, #OutboundDataBind", function () {
		var inbound_format = $("#InboundFormatData").val();
		var outbound_format = $("#OutboundFormatData").val();
		if (inbound_format != '') {
			var inboundAutocompleteDataArrayReturn = inboundautocompletedata(inbound_format, "inbound");
		}

		if (outbound_format != '') {
			var outboundAutocompleteDataArrayReturn = outboundautocompletedata(outbound_format, "inbound");
		}

		inOutAutocompleteDataArray = inboundAutocompleteDataArray.concat(outboundAutocompleteDataArray);
	});

	$("body").on("click", "#InboundDataBind_outbound, #OutboundDataBind_outbound", function () {
		var inbound_format = $("#InboundFormatData_outbound").val();
		var outbound_format = $("#OutboundFormatData_outbound").val();
		if (inbound_format != '') {
			var inboundAutocompleteDataArrayOutboundReturn = inboundautocompletedata(inbound_format, "outbound");
		}

		if (outbound_format != '') {
			var outboundAutocompleteDataArrayOutboundReturn = outboundautocompletedata(outbound_format, "outbound");
		}

		inOutAutocompleteDataArrayOutbound = inboundAutocompleteDataArrayOutbound.concat(outboundAutocompleteDataArrayOutbound);
	});

	// Only inbound autocomplete data - inboundAutocompleteDataArray
	// Only outbound autocomplete data - outboundAutocompleteDataArray
	// Both inbound and outbound autocomplete data - inOutAutocompleteDataArray
	$("body").on("keypress", ".autocompleteformula", function() {
		var id = $(this).attr('id');
		autocomplete(document.getElementById(id), inOutAutocompleteDataArray);
	});

	$("body").on("keypress", ".autocompleteinboundfilter", function() {
		var id = $(this).attr('id');
		autocomplete(document.getElementById(id), inboundAutocompleteDataArray);
	});

	// Only inbound autocomplete data - inboundAutocompleteDataArrayOutbound
	// Only outbound autocomplete data - outboundAutocompleteDataArrayOutbound
	// Both inbound and outbound autocomplete data - inOutAutocompleteDataArrayOutbound
	$("body").on("keypress", ".autocompleteformulaoutbound", function() {
		var id = $(this).attr('id');
		autocomplete(document.getElementById(id), inOutAutocompleteDataArrayOutbound);
	});

	$("body").on("keypress", ".autocompleteoutboundfilter", function() {
		var id = $(this).attr('id');
		autocomplete(document.getElementById(id), inboundAutocompleteDataArrayOutbound);
	});

	var onlyInboundI = 0;
	var onlyInboundN = 0;
	$("body").on("keypress", ".autocompletevalidation", function(e) {
		var errClass = $(this).attr("data-class");
		$('.' + errClass + 'inbounderror').hide();

		if (e.keyCode == 8) {
			onlyInboundI = 0; onlyInboundN = 0;
		}

		if ((onlyInboundI == 1 && e.keyCode != 105 && e.keyCode != 73) || (onlyInboundN == 1 && e.keyCode != 110 && e.keyCode != 78)) {
			$('.' + errClass + 'inbounderror').show();
			setTimeout(function() {
				$('.' + errClass + 'inbounderror').hide('blind', {}, 500)
			}, 5000);
			return false;
		}

		if (onlyInboundI == 1 && (e.keyCode == 105 || e.keyCode == 73)) {
			onlyInboundI = 0;
			onlyInboundN = 1;
		}

		if (onlyInboundN == 1 && (e.keyCode == 110 || e.keyCode == 78)) {
			onlyInboundI = 0;
			onlyInboundN = 0;
			$('.' + errClass + 'inbounderror').hide();
		}

		if (e.keyCode == 64 && onlyInboundI == 0) {
			onlyInboundI = 1;
		}

		var id = $(this).attr('id');
		autocomplete(document.getElementById(id), inboundAutocompleteDataArray);
	});

	$("#prop-format-additional-rules-table tbody").sortable({
		items: 'tr',
		cursor: 'pointer',
		axis: 'y',
		dropOnEmpty: false,
		start: function (e, ui) {
			ui.item.addClass("selected");
		},
		stop: function (e, ui) {
			ui.item.removeClass("selected");
			$(this).find("tr").each(function (index) {
			});
		}
	});

	$("#prop-outbound-format-additional-rules-table tbody").sortable({
		items: 'tr',
		cursor: 'pointer',
		axis: 'y',
		dropOnEmpty: false,
		start: function (e, ui) {
			ui.item.addClass("selected");
		},
		stop: function (e, ui) {
			ui.item.removeClass("selected");
			$(this).find("tr").each(function (index) {
			});
		}
	});

	$('body').on('click', '#cleanup-inbound-properties-btn', function() {
		swal({
			title: "Are you sure?",
			text: "Want to cleanup all properties?",
			type: "warning",
			showCancelButton: true,
			confirmButtonColor: "#DD6B55",
			confirmButtonText: "Yes, delete it!",
		}).then(function(isConfirm) {
			if (isConfirm.value) {
				itemProperties = [];
				currentItemProperty = {};
				currentItemPropertyEnable = 0;
				propsValidationRowCounter = 1;
				propsFormatRowCounter = 1;

				$('#mapping-formula-props #props-general-item').html("");
				$('#mapping-formula-props .table-section-linked-items-rows').remove();
				$('#mapping-formula-props #props-display-value').val("");
				$('#mapping-formula-props #props-display-default-value').val("");

				$('#mapping-formula-props #props-validation-is-required > option[value="FALSE"]').attr('selected', 'selected').prop('selected', true);

				$('#mapping-formula-props #props-validation-value-must-be > option[value=""]').attr('selected', true).prop('selected', true);

				$("table.prop-validation-additional-rules-table tbody").html("");
				$('#prop-validation-additional-rules-btn-add-row').trigger('click');

				$('#mapping-formula-props #props-format-is-trim > option[value="FALSE"]').attr('selected', 'selected').prop('selected', true);

				$('#mapping-formula-props #props-format-enable-rounding > option[value="FALSE"]').attr('selected', 'selected').prop('selected', true);

				$('#mapping-formula-props #props-format-enable-decimal > option[value="FALSE"]').attr('selected', 'selected').prop('selected', true);

				$('#mapping-formula-props #props-format-decimal').val("2");

				$("table.prop-format-additional-rules-table tbody").html("");
				$('#prop-format-additional-rules-btn-add-row').trigger('click');
			}
		});
	});

	$('body').on('click', '#cleanup-outbound-properties-btn', function() {
		swal({
			title: "Are you sure?",
			text: "Want to cleanup all properties?",
			type: "warning",
			showCancelButton: true,
			confirmButtonColor: "#DD6B55",
			confirmButtonText: "Yes, delete it!",
		}).then(function(isConfirm) {
			if (isConfirm.value) {
				itemPropertiesOutbound = [];
				currentItemPropertyOutbound = {};
				currentItemPropertyOutboundEnable = 0;
				propsOutboundValidationRowCounter = 1;
				propsOutboundFormatRowCounter = 1;

				$('#mapping-outbound-formula-props #props-outbound-general-item').html("");
				$('#mapping-outbound-formula-props .table-section-linked-items-rows').remove();
				$('#mapping-outbound-formula-props #props-outbound-display-value').val("");
				$('#mapping-outbound-formula-props #props-outbound-display-default-value').val("");

				$('#mapping-outbound-formula-props #props-outbound-validation-is-required > option[value="FALSE"]').attr('selected', 'selected').prop('selected', true);

				$('#mapping-outbound-formula-props #props-outbound-validation-value-must-be > option[value=""]').attr('selected', true).prop('selected', true);

				$("table.prop-outbound-validation-additional-rules-table tbody").html("");
				$('#prop-outbound-validation-additional-rules-btn-add-row').trigger('click');

				$('#mapping-outbound-formula-props #props-outbound-format-is-trim > option[value="FALSE"]').attr('selected', 'selected').prop('selected', true);

				$('#mapping-outbound-formula-props #props-outbound-format-enable-rounding > option[value="FALSE"]').attr('selected', 'selected').prop('selected', true);

				$('#mapping-outbound-formula-props #props-outbound-format-enable-decimal > option[value="FALSE"]').attr('selected', 'selected').prop('selected', true);

				$('#mapping-outbound-formula-props #props-outbound-format-decimal').val("2");

				$("table.prop-outbound-format-additional-rules-table tbody").html("");
				$('#prop-outbound-format-additional-rules-btn-add-row').trigger('click');
			}
		});
	});

	function editalltabs(item_id) {
		$.ajax({
			url: '/inbound_setting/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$("#inbound_setting_id").val(response.data._id);
					$('#inboundFormat').val(response.data.inbound_format);
					var max_file_downloads = (response.data.max_file_download == undefined) ? 50 : response.data.max_file_download;
					$('#max_file_download').val(max_file_downloads);

					if (response.data.inbound_format == 'json') {
						$('#inboundFormat > option:eq(0)').attr('selected', true);
						$('#select2-inboundFormat-container').attr("title", "JSON");
						$('#select2-inboundFormat-container').html("JSON");
					} else if (response.data.inbound_format == 'xml') {
						$('#inboundFormat > option:eq(1)').attr('selected', true);
						$('#select2-inboundFormat-container').attr("title", "XML");
						$('#select2-inboundFormat-container').html("XML");
					}

					$('#ftp_server_link').val(response.data.ftp_server_link);

					if (response.data.ftp_port == '' || response.data.ftp_port == undefined) {
						$('#port').val(response.data.port);
					} else {
						$('#port').val(response.data.ftp_port);
					}

					if (response.data.ftp_login_name == '' || response.data.ftp_login_name == undefined) {
						$('#login_name').val(response.data.login_name);
					} else {
						$('#login_name').val(response.data.ftp_login_name);
					}

					if (response.data.ftp_password == '' || response.data.ftp_password == undefined) {
						$('#password').val(response.data.password);
					} else {
						$('#password').val(response.data.ftp_password);
					}

					$('input[value="' + response.data.sync_type + '"]').prop('checked', true);

					if (response.data.sync_type == 'API' || response.data.sync_type == '' || response.data.sync_type == undefined) {
						$('#apiInUrlDiv').show();
						$('#api_options').show();
						var api_type = response.data.api_type;
						$('input[value="' + response.data.api_type + '"]').prop('checked', true);

						if (api_type == "User_API") {
							$('#api_ddep_api_input').hide();
							$('#api_user_api_input').show();
							$('#api_user_api').val(response.data.api_user_api);
							$('#inbound_shedule_setting_tab').show();
							$('#outbound_shedule_setting_tab').hide();
							$('#inbound_ddep_api_selected').hide();
							$('#outboud_max_post_file').hide();
							$('#collections_configure').show();
						}

						if (api_type == "DDEP_API") {
							$('#api_user_api_input').hide();
							$('#api_ddep_api_input').show();
							$('#api_ddep_api').val(response.data.api_ddep_api);
							$('#inbound_shedule_setting_tab').hide();
							$('#outbound_shedule_setting_tab').hide();
							$('#inbound_ddep_api_selected').show();
							$('#outboud_max_post_file').hide();
							$('#collections_configure').show();

							if (response.data.ddep_api_auth_type != '' && response.data.ddep_api_auth_type != 'No_Auth') {
								$('#ddep_api_auth_type option[value="' + response.data.ddep_api_auth_type + '"]').prop('selected', true);
								$('#ddep_api_auth_type').trigger('change');
								if (response.data.ddep_api_auth_type == 'API_Key' && response.data.ddep_api_authorization_api_keys != undefined && response.data.ddep_api_authorization_api_keys != '' && response.data.ddep_api_authorization_api_keys.length > 0) {
									for (var i = 0; i < response.data.ddep_api_authorization_api_keys.length; i++) {
										var subscriptionRow = '';
										subscriptionRow += '<div class="row col-12 authorization_api_keys_table_body"><div class="col-md-2">' + response.data.ddep_api_authorization_api_keys[i].Type + '</div><div class="col-md-6">' + response.data.ddep_api_authorization_api_keys[i].Key + '</div><div class="col-md-4">' + response.data.ddep_api_authorization_api_keys[i].Description + '</div></div>';
										$('#api_ddep_api_input .authorization_api_keys_table').append(subscriptionRow);
									}
									$('.authorization_api_key, .authorization_api_keys_table').show();
									authorizationApiKeyArray = response.data.ddep_api_authorization_api_keys;
								}
							}
						}
					} else if (response.data.sync_type == 'FTP' || response.data.sync_type == 'SFTP') {
						$('#ftpInDiv').show();
						$('#apiInUrlDiv').hide();
						$('#api_options').hide();
						$('#api_user_api_input').hide();
						$('#api_ddep_api_input_method').hide();
						$('#api_ddep_api_input_parameter').hide();
						$('#inbound_ddep_api_selected').hide();
						$('#outboud_max_post_file').show();
						$('#collections_configure').hide();
					}

					if (response.data.ftp_folder == '' || response.data.ftp_folder == undefined) {
						$('#folderpath').val(response.data.folder);
					} else {
						$('#folderpath').val(response.data.ftp_folder);
					}

					if (response.data.ftp_backup_folder == '' || response.data.ftp_backup_folder == undefined) {
						$('#backup_folder').val(response.data.backup_folder);
					} else {
						$('#backup_folder').val(response.data.ftp_backup_folder);
					}

					$('#is_password_encrypted option[value="' + response.data.is_password_encrypted + '"]').prop('selected', true);
					$('#is_password_encrypted').trigger('change');

					if (response.data.enableLog == undefined || response.data.enableLog == "off") {
						$('input[name="inboundEnableLogs"]').prop('checked', false);
					}

					if (response.data.is_active == "Active") {
						$('#is_active_inbound').removeClass('btn-secondary');
						$('#is_active_inbound').addClass('btn-success');
						$('#is_active_inbound').attr('data-value', 'Active');
						$('#is_active_inbound').html('Active');
					} else {
						$('#is_active_inbound').removeClass('btn-success');
						$('#is_active_inbound').addClass('btn-secondary');
						$('#is_active_inbound').attr('data-value', 'Inactive');
						$('#is_active_inbound').html('Inactive');
					}
				}
			}
		});

		$.ajax({
			url: '/project/item/filter/inbound/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$("#inbound_filter_id").val(response.data._id);
					var inbound_filter = response.data.inbound_filter;
					if (inbound_filter != '' && inbound_filter.length > 0) {
						var htmldata = '';
						for (var i = 0; i < inbound_filter.length; i++) {
							var newRow = "<tr>";
							var cols = "";
							cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="inboundfilter[][logical]">';
							cols += '<option value="AND"';

							if (inbound_filter[i].logical == 'AND') {
								cols += ' selected';
							}

							cols += '>AND</option>';
							cols += '<option value="OR"';

							if (inbound_filter[i].logical == 'OR') {
								cols += ' selected';
							}

							cols += '>OR</option>';
							cols += '</select></td>';
							cols += '<td class="col-sm-3 autocomplete"><input type="text" name="inboundfilter[][original]" class="form-control border-0 autocompleteinboundfilter" id="inboundfilteroriginal_' + i + '" value="' + inbound_filter[i].original + '"/></td>';
							cols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="inboundfilter[][operations]">';
							cols += '<option value="=="';

							if (inbound_filter[i].operations == '==') {
								cols += ' selected';
							}

							cols += '>=</option>';
							cols += '<option value=">"';

							if (inbound_filter[i].operations == '>') {
								cols += ' selected';
							}

							cols += '>></option>';
							cols += '<option value=">="';

							if (inbound_filter[i].operations == '>=') {
								cols += ' selected';
							}

							cols += '>>=</option>';
							cols += '<option value="<"';

							if (inbound_filter[i].operations == '<') {
								cols += ' selected';
							}

							cols += '><</option>';
							cols += '<option value="<="';

							if (inbound_filter[i].operations == '<=') {
								cols += ' selected';
							}

							cols += '><=</option>';
							cols += '<option value="<>"';

							if (inbound_filter[i].operations == '<>') {
								cols += ' selected';
							}

							cols += '><></option>';
							cols += '<option value="Contains"';

							if (inbound_filter[i].operations == 'Contains') {
								cols += ' selected';
							}

							cols += '>Contains</option>';
							cols += '</select></td>';
							cols += '<td class="col-sm-2 autocomplete"><input type="text" name="inboundfilter[][column]" class="form-control border-0 autocompleteinboundfilter" id="inboundfiltercolumn_' + i + '" value="' + inbound_filter[i].column + '"/></td>';

							cols += '<td class="col-sm-2"><a href="javascript:void(0);" type="button" class="inbound-filter-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

							newRow += cols;
							newRow += "</tr>";
							htmldata += newRow;
						}

						inboundFilterCounter = i;
						$("table.inbound-filter-table tbody").html(htmldata);
					}

					if (response.data.enableLog == undefined || response.data.enableLog == "off") {
						$('input[name="inboundFilterEnableLogs"]').prop('checked', false);
					}

					if (response.data.is_active == "Active") {
						$('#is_active_inbound_filter').removeClass('btn-secondary');
						$('#is_active_inbound_filter').addClass('btn-success');
						$('#is_active_inbound_filter').attr('data-value', 'Active');
						$('#is_active_inbound_filter').html('Active');
					} else {
						$('#is_active_inbound_filter').removeClass('btn-success');
						$('#is_active_inbound_filter').addClass('btn-secondary');
						$('#is_active_inbound_filter').attr('data-value', 'Inactive');
						$('#is_active_inbound_filter').html('Inactive');
					}
				}
			}
		});

		$.ajax({
			url: '/outbound_setting/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$('input[name="sync_type_out"]:checked').val(response.data.sync_type_out);
					$('#api_url').val(response.data.api_url);
					$('#outbound_format').val(response.data.outbound_format);
					var max_file_posts = (response.data.max_file_post == undefined) ? 50 : response.data.max_file_post;
					$('#max_file_post').val(max_file_posts);

					if (response.data.outbound_format == 'json') {
						$('#outbound_format > option:eq(0)').attr('selected', true);
						$('#select2-outbound_format-container').attr("title", "JSON");
						$('#select2-outbound_format-container').html("JSON");
					} else if (response.data.outbound_format == 'xml') {
						$('#outbound_format > option:eq(1)').attr('selected', true).trigger('change');
						$('#select2-outbound_format-container').html("XML").attr("title", "XML");
						$('#select2-outbound_format-container').html("XML");
					}

					$('#outbound_setting_id').val(response.data._id);

					if (response.data.enableLog == undefined || response.data.enableLog == "off") {
						$('input[name="outboundEnableLogs"]').prop('checked', false);
					}

					if (response.data.sendCollectionOnebyOne != undefined && response.data.sendCollectionOnebyOne == "on") {
						$('input[name="sendCollectionOnebyOne"]').prop('checked', true);
					}

					if (response.data.collections_name != undefined && response.data.collections_name != "") {
						$('#collections_name').val(response.data.collections_name);
					}

					if (response.data.is_active == "Active") {
						$('#is_active_outbound').removeClass('btn-secondary');
						$('#is_active_outbound').addClass('btn-success');
						$('#is_active_outbound').attr('data-value', 'Active');
						$('#is_active_outbound').html('Active');
					} else {
						$('#is_active_outbound').removeClass('btn-success');
						$('#is_active_outbound').addClass('btn-secondary');
						$('#is_active_outbound').attr('data-value', 'Inactive');
						$('#is_active_outbound').html('Inactive');
					}

					const globalHeaders = response?.globalHeaders;
					if (globalHeaders && globalHeaders.length > 0) {
						var globalHeadersHtml = '';
						for (var i = 0; i < globalHeaders.length; i++) {
							const status = (globalHeaders[i]?.status == "true") ? "checked" : "";
							const key = globalHeaders[i]?.key || "";
							const value = globalHeaders[i]?.value || "";
							const description = globalHeaders[i]?.description || "";

							if (key && value) {
								var newRow = "<tr>";
								var cols = "";
								cols += '<td class="col-sm-1 text-center"><div class="custom-control custom-checkbox"><input type="checkbox" name="outbound_global_headers_status" id="outbound_global_headers_status_' + i + '" class="custom-control-input" ' + status + ' /><label class="custom-control-label" for="outbound_global_headers_status_' + i + '"></label></div></td>'
								cols += '<td class="col-sm-3"><input type="text" name="outbound_global_headers[][key]" class="form-control border-0" data-class="outbound_global_headers_" id="key_' + i + '" value="' + key + '" /></td>';
								cols += '<td class="col-sm-4"><input type="text" name="outbound_global_headers[][value]" class="form-control border-0" data-class="outbound_global_headers_" id="value_' + i + '" value="' + value + '" /></td>';
								cols += '<td class="col-sm-3"><input type="text" name="outbound_global_headers[][description]" class="form-control border-0" data-class="outbound_global_headers_" id="description_' + i + '" value="' + description + '" /></td>';
								cols += '<td class="col-sm-1 text-center"><a href="javascript:void(0);" type="button" class="outbound-global-headers-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';
								newRow += cols;
								newRow += "</tr>";
								globalHeadersHtml += newRow;
							}
						}

						if (globalHeadersHtml) {
							outboundGlobalHeadersRowCounter = i;
							$("table.outbound-global-headers-table tbody").html(globalHeadersHtml);
						}
					}

					outboundSpecifyHeadersObj = response?.specifyHeaders || {};
				}
			}
		});

		$.ajax({
			url: '/outbound_validation/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$('#outbound_validation_id').val(response.data.id);
					var validations = response.data.validations;
					if (validations != '' && validations.length > 0) {
						var htmldata = '';
						for (var i = 0; i < validations.length; i++) {
							var newRow = "<tr>";
							var cols = "";
							cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="validations[][logical]">';
							cols += '<option value="AND"';

							if (validations[i].logical == 'AND') {
								cols += ' selected';
							}

							cols += '>AND</option>';
							cols += '<option value="OR"';

							if (validations[i].logical == 'OR') {
								cols += ' selected';
							}

							cols += '>OR</option>';
							cols += '</select></td>';
							cols += '<td class="col-sm-3 autocomplete"><input type="text" name="validations[][original]" class="form-control border-0 autocompletevalidation" data-class="outbound_validation_" id="original_' + i + '" value="' + validations[i].original + '"/></td>';
							cols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="validations[][operations]">';
							cols += '<option value="=="';

							if (validations[i].operations == '==') {
								cols += ' selected';
							}

							cols += '>=</option>';
							cols += '<option value=">"';

							if (validations[i].operations == '>') {
								cols += ' selected';
							}

							cols += '>></option>';
							cols += '<option value=">="';

							if (validations[i].operations == '>=') {
								cols += ' selected';
							}

							cols += '>>=</option>';
							cols += '<option value="<"';

							if (validations[i].operations == '<') {
								cols += ' selected';
							}

							cols += '><</option>';
							cols += '<option value="<="';

							if (validations[i].operations == '<=') {
								cols += ' selected';
							}

							cols += '><=</option>';
							cols += '<option value="<>"';

							if (validations[i].operations == '<>') {
								cols += ' selected';
							}

							cols += '><></option>';
							cols += '<option value="Contains"';

							if (validations[i].operations == 'Contains') {
								cols += ' selected';
							}

							cols += '>Contains</option>';
							cols += '</select></td>';
							cols += '<td class="col-sm-2 autocomplete"><input type="text" name="validations[][column]" class="form-control border-0 autocompletevalidation" data-class="outbound_validation_" id="column_' + i + '" value="' + validations[i].column + '"/></td>';
							cols += '<td class="col-sm-2"><select class="select-dropdown form-control form-control-lg" name="validations[][then]"><option value="STOP">STOP</option></select></td>';

							if (validations[i].formula != undefined) {
								cols += '<td class="col-sm-2 autocomplete"><input type="text" name="validations[][formula]" class="form-control border-0 autocompletevalidation" data-class="outbound_validation_" id="validformula_' + i + '" value="' + validations[i].formula + '"/></td>';
							} else {
								cols += '<td class="col-sm-2 autocomplete"><input type="text" name="validations[][formula]" class="form-control border-0 autocompletevalidation" data-class="outbound_validation_" id="validformula_' + i + '" value=""/></td>';
							}

							cols += '<td class="col-sm-2"><a href="javascript:void(0);" type="button" class="outbound-validation-rules-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

							newRow += cols;
							newRow += "</tr>";
							htmldata += newRow;
						}

						validationRowCounter = i;
						$("table.outbound-validation-rules-table tbody").html(htmldata);
					}
				}
			}
		});

		$.ajax({
			url: '/project/item/mapping/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$("#mapping_setting_id").val(response.data._id);
					$('#InboundFormatData').val(response.data.inbound_format);
					$('#OutboundFormatData').val(response.data.outbound_format);
					$('#mySavedModel').val(response.data.mapping_data);

					if (response.data.enableLog == undefined || response.data.enableLog == "off") {
						$('input[name="inboundMappingEnableLogs"]').prop('checked', false);
					}

					if (response.data.is_active == "Active") {
						$('#is_active_mapping').removeClass('btn-secondary');
						$('#is_active_mapping').addClass('btn-success');
						$('#is_active_mapping').attr('data-value', 'Active');
						$('#is_active_mapping').html('Active');
					} else {
						$('#is_active_mapping').removeClass('btn-success');
						$('#is_active_mapping').addClass('btn-secondary');
						$('#is_active_mapping').attr('data-value', 'Inactive');
						$('#is_active_mapping').html('Inactive');
					}

					if (response?.data?.mapping_data) {
						var mapping_data = JSON.parse(response.data.mapping_data);
						if (mapping_data != '' && mapping_data.nodeDataArray != undefined && mapping_data.nodeDataArray.length > 0) {
							nodeDataArray = mapping_data.nodeDataArray;
							linkDataArray = (mapping_data.linkDataArray != undefined && mapping_data.linkDataArray.length > 0) ? mapping_data.linkDataArray : [];

							// Init GOJS UI
							myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);

							var inboundAutocompleteDataArrayReturn = inboundautocompletedata(response.data.inbound_format, "inbound");
							var outboundAutocompleteDataArrayReturn = outboundautocompletedata(response.data.outbound_format, "inbound");
							inOutAutocompleteDataArray = inboundAutocompleteDataArray.concat(outboundAutocompleteDataArray);
						}
					}
				}
			}
		});

		$.ajax({
			url: '/project/item/properties/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$("#props_setting_id").val(response.data._id);
					if (response.data.item_properties != undefined) {
						itemProperties = response.data.item_properties;
					}
				}
			}
		});

		$.ajax({
			url: '/project/item/filter/outbound/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$("#outbound_filter_id").val(response.data._id);
					var outbound_filter = response.data.outbound_filter;
					if (outbound_filter != '' && outbound_filter.length > 0) {
						var htmldata = '';
						for (var i = 0; i < outbound_filter.length; i++) {
							var newRow = "<tr>";
							var cols = "";
							cols += '<td class="col-sm-2 logical-select"><select class="select-dropdown form-control form-control-lg" name="outboundfilter[][logical]">';
							cols += '<option value="AND"';

							if (outbound_filter[i].logical == 'AND') {
								cols += ' selected';
							}

							cols += '>AND</option>';
							cols += '<option value="OR"';

							if (outbound_filter[i].logical == 'OR') {
								cols += ' selected';
							}

							cols += '>OR</option>';
							cols += '</select></td>';
							cols += '<td class="col-sm-3 autocomplete"><input type="text" name="outboundfilter[][original]" class="form-control border-0 autocompleteoutboundfilter" id="outboundfilteroriginal_' + i + '" value="' + outbound_filter[i].original + '"/></td>';
							cols += '<td class="col-sm-3 operations-select"><select class="select-dropdown form-control form-control-lg" name="outboundfilter[][operations]">';
							cols += '<option value="=="';

							if (outbound_filter[i].operations == '==') {
								cols += ' selected';
							}

							cols += '>=</option>';
							cols += '<option value=">"';

							if (outbound_filter[i].operations == '>') {
								cols += ' selected';
							}

							cols += '>></option>';
							cols += '<option value=">="';

							if (outbound_filter[i].operations == '>=') {
								cols += ' selected';
							}

							cols += '>>=</option>';
							cols += '<option value="<"';

							if (outbound_filter[i].operations == '<') {
								cols += ' selected';
							}

							cols += '><</option>';
							cols += '<option value="<="';

							if (outbound_filter[i].operations == '<=') {
								cols += ' selected';
							}

							cols += '><=</option>';
							cols += '<option value="<>"';

							if (outbound_filter[i].operations == '<>') {
								cols += ' selected';
							}

							cols += '><></option>';
							cols += '<option value="Contains"';

							if (outbound_filter[i].operations == 'Contains') {
								cols += ' selected';
							}

							cols += '>Contains</option>';
							cols += '</select></td>';
							cols += '<td class="col-sm-2 autocomplete"><input type="text" name="outboundfilter[][column]" class="form-control border-0 autocompleteoutboundfilter" id="outboundfiltercolumn_' + i + '" value="' + outbound_filter[i].column + '"/></td>';

							cols += '<td class="col-sm-2"><a href="javascript:void(0);" type="button" class="outbound-filter-btn-del btn btn-lg btn-block modal-button"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minus font-medium-2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></a></td>';

							newRow += cols;
							newRow += "</tr>";
							htmldata += newRow;
						}

						outboundFilterCounter = i;
						$("table.outbound-filter-table tbody").html(htmldata);
					}

					if (response.data.enableLog == undefined || response.data.enableLog == "off") {
						$('input[name="outboundFilterEnableLogs"]').prop('checked', false);
					}

					if (response.data.is_active == "Active") {
						$('#is_active_outbound_filter').removeClass('btn-secondary');
						$('#is_active_outbound_filter').addClass('btn-success');
						$('#is_active_outbound_filter').attr('data-value', 'Active');
						$('#is_active_outbound_filter').html('Active');
					} else {
						$('#is_active_outbound_filter').removeClass('btn-success');
						$('#is_active_outbound_filter').addClass('btn-secondary');
						$('#is_active_outbound_filter').attr('data-value', 'Inactive');
						$('#is_active_outbound_filter').html('Inactive');
					}
				}
			}
		});

		$.ajax({
			url: '/project/item/mapping-outbound/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$("#outbound_mapping_setting_id").val(response.data._id);
					$('#InboundFormatData_outbound').val(response.data.inbound_format);
					$('#OutboundFormatData_outbound').val(response.data.outbound_format);
					$('#outboundmySavedModel').val(response.data.mapping_data);

					if (response.data.enableLog == undefined || response.data.enableLog == "off") {
						$('input[name="outboundMappingEnableLogs"]').prop('checked', false);
					}

					if (response.data.is_active == "Active") {
						$('#is_active_outbound_mapping').removeClass('btn-secondary');
						$('#is_active_outbound_mapping').addClass('btn-success');
						$('#is_active_outbound_mapping').attr('data-value', 'Active');
						$('#is_active_outbound_mapping').html('Active');
					} else {
						$('#is_active_outbound_mapping').removeClass('btn-success');
						$('#is_active_outbound_mapping').addClass('btn-secondary');
						$('#is_active_outbound_mapping').attr('data-value', 'Inactive');
						$('#is_active_outbound_mapping').html('Inactive');
					}

					if (response.data.mapping_data) {
						var mapping_data = JSON.parse(response.data.mapping_data);
						if (mapping_data != '' && mapping_data.nodeDataArray != undefined && mapping_data.nodeDataArray.length > 0) {
							nodeDataArrayOutbound = mapping_data.nodeDataArray;
							linkDataArrayOutbound = (mapping_data.linkDataArray != undefined && mapping_data.linkDataArray.length > 0) ? mapping_data.linkDataArray : [];

							// Init GOJS UI
							outboundmyDiagram.model = new go.GraphLinksModel(nodeDataArrayOutbound, linkDataArrayOutbound);

							var inboundAutocompleteDataArrayOutboundReturn = inboundautocompletedata(response.data.inbound_format, "outbound");
							var outboundAutocompleteDataArrayOutboundReturn = outboundautocompletedata(response.data.outbound_format, "outbound");
							inOutAutocompleteDataArrayOutbound = inboundAutocompleteDataArrayOutbound.concat(outboundAutocompleteDataArrayOutbound);
						}
					}
				}
			}
		});

		$.ajax({
			url: '/project/item/properties-outbound/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$("#outbound_props_setting_id").val(response.data._id);
					if (response.data.item_properties != undefined) {
						itemPropertiesOutbound = response.data.item_properties;
					}
				}
			}
		});

		$.ajax({
			url: '/schedule_setting/editAPI/' + item_id,
			method: 'get',
			dataType: 'json',
			success: function(response, textStatus, xhr) {
				if (xhr.status == 200) {
					$('input[name="s_configure_inbound"][value="' + response.data.Schedule_configure_inbound + '"]').prop('checked', true);

					if (response.data.Schedule_configure_inbound == 'click_by_user') {
						$('div.relation-schedule-open').hide();
					} else {
						$('div.relation-schedule-open').show();
					}

					if (response.data.Schedule_configure_outbound == 'click_by_user') {
						$('div.relation-outbound-schedule-open').hide();
					} else {
						$('div.relation-outbound-schedule-open').show();
					}

					$('input[name="schedule_type_inbound"][value="' + response.data.schedule_type_inbound + '"]').prop('checked', true);

					if (response.data.schedule_type_inbound == 'OneTime') {
						$('#inbound-data-recurring').hide();
						$('#inbound-data-one-time').show();
						$('#one_time_occurrence_inbound_date').val(response.data.one_time_occurrence_inbound_date);
						$('#one_time_occurrence_inbound_time').val(response.data.one_time_occurrence_inbound_time);
					} else {
						$('#inbound-data-recurring').show();
						$('#inbound-data-one-time').hide();
					}

					if (response.data.schedule_type_outbound == 'OneTime') {
						$('#outbound-data-recurring').hide();
						$('#outbound-data-one-time').show();
						$('#one_time_occurrence_outbound_date').val(response.data.one_time_occurrence_outbound_date);
						$('#one_time_occurrence_outbound_time').val(response.data.one_time_occurrence_outbound_time);
					} else {
						$('#outbound-data-recurring').show();
						$('#outbound-data-one-time').hide();
					}

					$('#occurs_time_inbound').val(response.data.occurs_inbound).change();
					$('input[name="s_configure_outbound"][value="' + response.data.Schedule_configure_outbound + '"]').prop('checked', true);
					$('input[name="schedule_type_outbound"][value="' + response.data.schedule_type_outbound + '"]').prop('checked', true);
					$('#day_frequency_inbound_count').val(response.data.day_frequency_inbound_count);
					$('#day_frequency_outbound_count').val(response.data.day_frequency_outbound_count);
					$('#weekly_frequency_inbound_count').val(response.data.weekly_frequency_inbound_count);
					$('#weekly_frequency_outbound_count').val(response.data.weekly_frequency_outbound_count);
					$('#weekly_frequency_inbound_count').val(response.data.weekly_frequency_inbound_count);
					$('#weekly_frequency_outbound_count').val(response.data.weekly_frequency_outbound_count);
					$('#monthly_frequency_day_inbound').val(response.data.monthly_frequency_day_inbound);
					$('#monthly_frequency_day_outbound').val(response.data.monthly_frequency_day_outbound);
					$('#monthly_frequency_day_inbound_count').val(response.data.monthly_frequency_day_inbound_count);
					$('#monthly_frequency_day_outbound_count').val(response.data.monthly_frequency_day_outbound_count);
					$('#monthly_frequency_the_inbound_count').val(response.data.monthly_frequency_the_inbound_count);
					$('#monthly_frequency_the_outbound_count').val(response.data.monthly_frequency_the_outbound_count);
					$('input[name="daily_frequency_type_inbound"][value="' + response.data.daily_frequency_type_inbound + '"]').prop('checked', true);
					$('input[name="daily_frequency_type_outbound"][value="' + response.data.daily_frequency_type_outbound + '"]').prop('checked', true);
					$('#daily_frequency_once_time_inbound').val(response.data.daily_frequency_once_time_inbound);
					$('#daily_frequency_once_time_outbound').val(response.data.daily_frequency_once_time_outbound);

					if ($('input[name="daily_frequency_type_inbound"]:checked').val() == 'Occurs every') {
						$("#daily_frequency_once_time_inbound").hide();
						$("#recursEveryDiv").show();
						$("#startingEndingDiv").show();
						$('#daily_frequency_every_time_unit_inbound').val(response.data.daily_frequency_every_time_unit_inbound).change();
						$('#daily_frequency_every_time_count_inbound').val(response.data.daily_frequency_every_time_count_inbound);
						$('#daily_frequency_every_time_count_start_inbound').val(response.data.daily_frequency_every_time_count_start_inbound);
						$('#daily_frequency_every_time_count_end_inbound').val(response.data.daily_frequency_every_time_count_end_inbound);
					}

					if ($('input[name="daily_frequency_type_outbound"]:checked').val() == 'Occurs every') {
						$("#daily_frequency_once_time_outbound").hide();
						$("#recursEveryDivOutbound").show();
						$("#startingEndingDivOutbound").show();
						$('#daily_frequency_every_time_unit_outbound').val(response.data.daily_frequency_every_time_unit_outbound).change();
						$('#daily_frequency_every_time_count_outbound').val(response.data.daily_frequency_every_time_count_outbound);
						$('#daily_frequency_every_time_count_start_outbound').val(response.data.daily_frequency_every_time_count_start_outbound);
						$('#daily_frequency_every_time_count_end_outbound').val(response.data.daily_frequency_every_time_count_end_outbound);
					}

					$("#occurs_time_inbound").val(response.data.occurs_inbound);
					$("#occurs_time_inbound").select2().trigger("change");
					$("#occurs_time_outbound").val(response.data.occurs_outbound)
					$("#occurs_time_outbound").select2().trigger("change");
					$("#schedule_setting_id").val(response.data._id);

					if (response.data.duration_inbound_start_date != undefined) {
						$('#duration_inbound_start_date').val(response.data.duration_inbound_start_date);
					}

					if (response.data.duration_inbound_is_end_date != undefined) {
						$('input[name="duration_inbound_is_end_date"][value="' + response.data.duration_inbound_is_end_date + '"]').prop('checked', true);
						if (response.data.duration_inbound_is_end_date == 'no_end_date') {
							$('#duration_inbound_end_date').addClass('hidden');
						}
					}

					if (response.data.duration_inbound_end_date != undefined) {
						$('#duration_inbound_end_date').val(response.data.duration_inbound_end_date);
					}

					if (response.data.duration_outbound_start_date != undefined) {
						$('#duration_outbound_start_date').val(response.data.duration_outbound_start_date);
					}

					if (response.data.duration_outbound_is_end_date != undefined) {
						$('input[name="duration_outbound_is_end_date"][value="' + response.data.duration_outbound_is_end_date + '"]').prop('checked', true);
						if (response.data.duration_outbound_is_end_date == 'no_end_date') {
							$('#duration_outbound_end_date').addClass('hidden');
						}
					}

					if (response.data.duration_outbound_end_date != undefined) {
						$('#duration_outbound_end_date').val(response.data.duration_outbound_end_date);
					}

					if (response.data.occurs_inbound == "weekly") {
						$(response.data.occurs_weekly_fields_inbound).each(function(index, item) {
							$('input[name="occurs_weekly_fields_inbound"][value="' + item.day + '"]').prop('checked', true);
						});
					}

					if (response.data.occurs_outbound == "weekly") {
						$(response.data.occurs_weekly_fields_outbound).each(function(index, item) {
							$('input[name = occurs_weekly_fields_outbound][value="' + item.day + '"]').prop('checked', true);
						});
					}

					if (response.data.occurs_inbound == "monthly") {
						$(response.data.monthly_field_setting_inbound).each(function(index, item) {
							if (item.inbound_monthly_day == "the") {
								$('input[name=inbound_monthly_day][value="The"]').prop('checked', true).trigger('change');
								$('#day_txt_box_inbound').hide();
								$('#the_section_inbound').show();
								$('#the_day_of').val(item.the_day_of).change();
								$('#the_days').val(item.the_days).change();
							} else {
								$('#the_section_inbound').hide();
								$('#day_txt_box_inbound').show();
							}
						});
					}

					if (response.data.occurs_outbound == "monthly") {
						$(response.data.monthly_field_setting_outbound).each(function(index, item) {
							if (item.outbound_monthly_day == "the") {
								$('input[name=outbound_monthly_day][value="The"]').prop('checked', true).trigger('change');
								$('#day_txt_box_outbound').hide();
								$('#the_section_outbound').show();
								$('#the_day_of_outbound').val(item.the_day_of).change();
								$('#the_days_outbound').val(item.the_days).change();
							} else {
								$('#the_section_outbound').hide();
								$('#day_txt_box_outbound').show();
							}
						});
					}

					if (response.data.enableLog == undefined || response.data.enableLog == "off") {
						$('input[name="ScheduleEnableLogs"]').prop('checked', false);
					}
				}
			}
		});
	}

	function inboundautocompletedata(reqBody, type = "inbound") {
		if (type == "inbound") {
			inboundAutocompleteDataArray = [];
		}

		if (type == "outbound") {
			inboundAutocompleteDataArrayOutbound = [];
		}

		var isJson = IsJsonString(reqBody);
		if (isJson) {
			var data = JSON.parse(reqBody);
			if (Array.isArray(data)) {
				const arrData = data;
				data = {};
				data['items'] = arrData;
			}
			Object.entries(data).forEach((entry) => {
				const [key, value] = entry;

				var newKey = '@In{' + key + '}';
				var normalKey = key;
				if (key >= 0) {} else {
					if (type == "inbound") {
						var key_count = checkInboundAutocompleteKey(newKey, inboundAutocompleteDataArray);
					}

					if (type == "outbound") {
						var key_count = checkInboundAutocompleteKey(newKey, inboundAutocompleteDataArrayOutbound);
					}
				}

				if (key_count > 1) {
					newKey = '@In{' + key + key_count + '}';
					normalKey = normalKey + key_count;
				}

				if (key >= 0) {} else {
					if (type == "inbound") {
						inboundAutocompleteDataArray.push(newKey);
					}

					if (type == "outbound") {
						inboundAutocompleteDataArrayOutbound.push(newKey);
					}
				}

				if (!Array.isArray(value) && value != null && typeof(value) != "object") {
				}

				if (!Array.isArray(value) && value != null && typeof(value) == "object") {
					var newtest = inboundautocompletedata1(normalKey, value, false, type);
				}

				if (Array.isArray(value) && value != null && typeof(value) == "object") {
					var newtest = inboundautocompletedata1(normalKey, value, true, type);
				}
			});

			if (type == "inbound") {
				return inboundAutocompleteDataArray;
			}

			if (type == "outbound") {
				return inboundAutocompleteDataArrayOutbound;
			}
		} else {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({'display':'block'});

			$.ajax({
				url: '/mapping/convert/xml2JSON',
				method: 'POST',
				dataType: 'JSON',
				contentType: 'application/xml',
				data: reqBody,
				header: {
					"content-type": 'application/xml'
				},
				success: function(response) {
					var data = response;
					if (Array.isArray(data)) {
						const arrData = data;
						data = {};
						data['items'] = arrData;
					}

					Object.entries(data).forEach((entry) => {
						const [key, value] = entry;

						var newKey = '@In{' + key + '}';
						var normalKey = key;
						if (key >= 0) {} else {
							if (type == "inbound") {
								var key_count = checkInboundAutocompleteKey(newKey, inboundAutocompleteDataArray);
							}

							if (type == "outbound") {
								var key_count = checkInboundAutocompleteKey(newKey, inboundAutocompleteDataArrayOutbound);
							}
						}

						if (key_count > 1) {
							newKey = '@In{' + key + key_count + '}';
							normalKey = normalKey + key_count;
						}

						if (key >= 0) {} else {
							if (type == "inbound") {
								inboundAutocompleteDataArray.push(newKey);
							}

							if (type == "outbound") {
								inboundAutocompleteDataArrayOutbound.push(newKey);
							}
						}

						if (!Array.isArray(value) && value != null && typeof(value) != "object") {
						}

						if (!Array.isArray(value) && value != null && typeof(value) == "object") {
							var newtest = inboundautocompletedata1(normalKey, value, false, type);
						}

						if (Array.isArray(value) && value != null && typeof(value) == "object") {
							var newtest = inboundautocompletedata1(normalKey, value, true, type);
						}
					});

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});

					if (type == "inbound") {
						return inboundAutocompleteDataArray;
					}

					if (type == "outbound") {
						return inboundAutocompleteDataArrayOutbound;
					}
				},
				error: function(textStatus, error) {
					if (textStatus.responseJSON.status == 404) {
						window.location.href = "/404";
					} else {
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({'display':'none'});
						swal({
							title: "Error!",
							text: textStatus.responseJSON.message,
							type: "error",
							timer: 1200
						});
						return false;
					}
				}
			});
		}
	}

	function inboundautocompletedata1(normalKey, reqBody, isArray, type) {
		var retrun = '';
		var parentKeya = normalKey;
		Object.entries(reqBody).forEach((entry) => {
			const [key, value] = entry;

			var normalKey = parentKeya;
			if (key >= 0) {
				var newKey = '@In{' + normalKey + '}';
				normalKey = normalKey;
			} else {
				var newKey = '@In{' + normalKey + '.' + key + '}';
				normalKey = normalKey + '.' + key;
			}

			if (key >= 0) {} else {
				if (type == "inbound") {
					var key_count = checkInboundAutocompleteKey(newKey, inboundAutocompleteDataArray);
				}

				if (type == "outbound") {
					var key_count = checkInboundAutocompleteKey(newKey, inboundAutocompleteDataArrayOutbound);
				}
			}

			if (key_count > 1 && !isArray) {
				newKey = '@In{' + normalKey + key_count + '}';
				normalKey = normalKey + key_count;
			}

			if (key >= 0) {} else {
				if (key_count > 1 && isArray) {} else {
					if (type == "inbound") {
						inboundAutocompleteDataArray.push(newKey);
					}

					if (type == "outbound") {
						inboundAutocompleteDataArrayOutbound.push(newKey);
					}
				}
			}

			if (!Array.isArray(value) && value != null && typeof(value) != "object") {
			}

			if (!Array.isArray(value) && value != null && typeof(value) == "object") {
				var newtest = inboundautocompletedata1(normalKey, value, false, type);
			}

			if (Array.isArray(value) && value != null && typeof(value) == "object") {
				var newtest = inboundautocompletedata1(normalKey, value, true, type);
			}
		});

		return retrun;
	}

	function outboundautocompletedata(reqBody, type = "inbound") {
		if (type == "inbound") {
			outboundAutocompleteDataArray = [];
		}

		if (type == "outbound") {
			outboundAutocompleteDataArrayOutbound = [];
		}

		var isJson = IsJsonString(reqBody);
		if (isJson) {
			var data = JSON.parse(reqBody);
			if (Array.isArray(data)) {
				const arrData = data;
				data = {};
				data['items'] = arrData;
			}
			Object.entries(data).forEach((entry) => {
				const [key, value] = entry;

				var newKey = '@Out{' + key + '}';
				var normalKey = key;
				if (key >= 0) {} else {
					if (type == "inbound") {
						var key_count = checkInboundAutocompleteKey(newKey, outboundAutocompleteDataArray);
					}

					if (type == "outbound") {
						var key_count = checkInboundAutocompleteKey(newKey, outboundAutocompleteDataArrayOutbound);
					}
				}

				if (key_count > 1) {
					newKey = '@Out{' + key + key_count + '}';
					normalKey = normalKey + key_count;
				}

				if (key >= 0) {} else {
					if (type == "inbound") {
						outboundAutocompleteDataArray.push(newKey);
					}

					if (type == "outbound") {
						outboundAutocompleteDataArrayOutbound.push(newKey);
					}
				}

				if (!Array.isArray(value) && value != null && typeof(value) == "object") {
					var newtest = outboundautocompletedata1(normalKey, value, false, type);
				}

				if (Array.isArray(value) && value != null && typeof(value) == "object") {
					var newtest = outboundautocompletedata1(normalKey, value, true, type);
				}
			});

			if (type == "inbound") {
				return outboundAutocompleteDataArray;
			}

			if (type == "outbound") {
				return outboundAutocompleteDataArrayOutbound;
			}
		} else {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({'display':'block'});

			$.ajax({
				url: '/mapping/convert/xml2JSON',
				method: 'POST',
				dataType: 'JSON',
				contentType: 'application/xml',
				data: reqBody,
				header: {
					"content-type": 'application/xml'
				},
				success: function(response) {
					var data = response;
					if (Array.isArray(data)) {
						const arrData = data;
						data = {};
						data['items'] = arrData;
					}

					Object.entries(data).forEach((entry) => {
						const [key, value] = entry;

						var newKey = '@Out{' + key + '}';
						var normalKey = key;
						if (key >= 0) {} else {
							if (type == "inbound") {
								var key_count = checkInboundAutocompleteKey(newKey, outboundAutocompleteDataArray);
							}

							if (type == "outbound") {
								var key_count = checkInboundAutocompleteKey(newKey, outboundAutocompleteDataArrayOutbound);
							}
						}

						if (key_count > 1) {
							newKey = '@Out{' + key + key_count + '}';
							normalKey = normalKey + key_count;
						}

						if (key >= 0) {} else {
							if (type == "inbound") {
								outboundAutocompleteDataArray.push(newKey);
							}

							if (type == "outbound") {
								outboundAutocompleteDataArrayOutbound.push(newKey);
							}
						}

						if (!Array.isArray(value) && value != null && typeof(value) == "object") {
							var newtest = outboundautocompletedata1(normalKey, value, false, type);
						}

						if (Array.isArray(value) && value != null && typeof(value) == "object") {
							var newtest = outboundautocompletedata1(normalKey, value, true, type);
						}
					});

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});

					if (type == "inbound") {
						return outboundAutocompleteDataArray;
					}

					if (type == "outbound") {
						return outboundAutocompleteDataArrayOutbound;
					}
				},
				error: function(textStatus, error) {
					if (textStatus.responseJSON.status == 404) {
						window.location.href = "/404";
					} else {
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({'display':'none'});
						swal({
							title: "Error!",
							text: textStatus.responseJSON.message,
							type: "error",
							timer: 1200
						});
						return false;
					}
				}
			});
		}
	}

	function outboundautocompletedata1(normalKey, reqBody, isArray, type) {
		var retrun = '';
		var parentKeya = normalKey;
		Object.entries(reqBody).forEach((entry) => {
			const [key, value] = entry;

			var normalKey = parentKeya;
			if (key >= 0) {
				var newKey = '@Out{' + normalKey + '}';
				normalKey = normalKey;
			} else {
				var newKey = '@Out{' + normalKey + '.' + key + '}';
				normalKey = normalKey + '.' + key;
			}

			if (key >= 0) {} else {
				if (type == "inbound") {
					var key_count = checkInboundAutocompleteKey(newKey, outboundAutocompleteDataArray);
				}

				if (type == "outbound") {
					var key_count = checkInboundAutocompleteKey(newKey, outboundAutocompleteDataArrayOutbound);
				}
			}

			if (key_count > 1 && !isArray) {
				newKey = '@Out{' + normalKey + key_count + '}';
				normalKey = normalKey + key_count;
			}

			if (key >= 0) {} else {
				if (key_count > 1 && isArray) {} else {
					if (type == "inbound") {
						outboundAutocompleteDataArray.push(newKey);
					}

					if (type == "outbound") {
						outboundAutocompleteDataArrayOutbound.push(newKey);
					}
				}
			}

			if (!Array.isArray(value) && value != null && typeof(value) == "object") {
				var newtest = outboundautocompletedata1(normalKey, value, false, type);
			}

			if (Array.isArray(value) && value != null && typeof(value) == "object") {
				var newtest = outboundautocompletedata1(normalKey, value, true, type);
			}
		});

		return retrun;
	}

	function checkInboundAutocompleteKey(key, dataArray) {
		var j = 1;
		for (var i = 0; i < dataArray.length; i++) {
			var key1 = (j == 1) ? key : key + j;
			if (dataArray[i] == key1) {
				j++;
			}
		}
		return j;
	}

	function autocomplete(inp, arr) {
		var currentFocus;
		var newValue = 0;
		var fullValue = '';
		inp.addEventListener("keyup", function(e) {
			if ((e.keyCode == 8 || e.keyCode >= 48 && e.keyCode <= 90 ) || ( e.keyCode >= 96 && e.keyCode <= 105 ) || ( e.keyCode >= 186 && e.keyCode <= 222 )) {
				if (e.keyCode == 8) {
					onlyInboundI = 0; onlyInboundN = 0;
				}
				var a, b, i, val = inp.value;
				if (newValue == 0 && e.key == '@') {
					val = e.key;
					newValue = 1;
				}
				if (val.includes('@')) {
					var pieces = val.split("@");
					if (pieces[pieces.length - 1] != undefined) {
						val = '@' + pieces[pieces.length - 1];
					} else {
						val = '@';
					}
				}

				closeAllLists();
				if (!val) {return false;}
				currentFocus = -1;

				a = document.createElement("DIV");
				a.setAttribute("id", this.id + "autocomplete-list");
				a.setAttribute("class", "autocomplete-items");

				this.parentNode.appendChild(a);

				for (i = 0; i < arr.length; i++) {
					if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
						b = document.createElement("DIV");
						b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
						b.innerHTML += arr[i].substr(val.length);
						b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
						b.addEventListener("click", function(e) {
							var values = '';
							if (pieces != undefined) {
								for (var j = 0; j < pieces.length - 1; j++) {
									if (pieces[j] != '') {
										if (pieces[j].startsWith("In{")) {
											values += '@' + pieces[j];
										} else {
											values += pieces[j];
										}
									}
								}
							}
							inp.value = values+this.getElementsByTagName("input")[0].value;
							fullValue = inp.value;
							newValue = 0;
							closeAllLists();
						});
						a.appendChild(b);
					}
				}
			} else {
				if (e.keyCode == 46) {
					newValue = 0;
				}
			}
		});

		inp.addEventListener("keydown", function(e) {
			var x = document.getElementById(this.id + "autocomplete-list");
			if (x) x = x.getElementsByTagName("div");
			if (e.keyCode == 40) {
				currentFocus++;
				addActive(x);
			} else if (e.keyCode == 38) {
				currentFocus--;
				addActive(x);
			} else if (e.keyCode == 13) {
				e.preventDefault();
				if (currentFocus > -1) {
					if (x) x[currentFocus].click();
				}
			}
		});

		function addActive(x) {
			if (!x) return false;
			removeActive(x);
			if (currentFocus >= x.length) currentFocus = 0;
			if (currentFocus < 0) currentFocus = (x.length - 1);
			x[currentFocus].classList.add("autocomplete-active");
		}

		function removeActive(x) {
			for (var i = 0; i < x.length; i++) {
				x[i].classList.remove("autocomplete-active");
			}
		}

		function closeAllLists(elmnt) {
			var x = document.getElementsByClassName("autocomplete-items");
			for (var i = 0; i < x.length; i++) {
				if (elmnt != x[i] && elmnt != inp) {
					x[i].parentNode.removeChild(x[i]);
				}
			}
		}

		document.addEventListener("click", function (e) {
			closeAllLists(e.target);
		});
	}

	function IsJsonString(str) {
		try {
			JSON.parse(str);
		} catch (e) {
			return false;
		}
		return true;
	}
});
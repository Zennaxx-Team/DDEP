if ($("#frm-save-smtp").length) {
	$("#frm-save-smtp").validate({
		errorClass: "help-block animation-slideDown error",
		errorElement: "div",
		errorPlacement: function(error, e) {
			e.parents(".form-group").append(error);
		},
		highlight: function(e) {
			$(e).removeClass("success error").addClass("error");
			$(e).closest(".help-block").remove();
		},
		success: function(e) {
			e.removeClass("success error");
			e.closest(".help-block").remove();
		},
		Submit: function() {
		},
		rules: {
			smtpServer: {
				required: true
			},
			smtpAccount: {
				required: true
			},
			smtpEmail: {
				required: true,
				email: true
			},
			smtpPort: {
				required: true
			},
			smtpProperties: {
				required: true
			},
			smtpPassword: {
				required: true
			}
		},
		messages: {
			smtpServer: {
				required: "Please enter SMTP server",
			},
			smtpAccount: {
				required: "Please enter account",
			},
			smtpEmail: {
				required: "Please enter email",
			},
			smtpPort: {
				required: "Please enter SMTP port",
			},
			smtpProperties: {
				required: "Please select SMTP properties",
			},
			smtpPassword: {
				required: "Please enter password",
			}
		},
		submitHandler: function(e) {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({'display':'block'});

			let url = "/settings/save-email-smtp";
			if ($("#data_id").val() != "") {
				url = "/settings/update-email-smtp";
			}

			$.ajax({
				url: url,
				method: "post",
				dataType: "json",
				data: {
					data_id: $("#data_id").val(),
					smtpServer: $("#smtpServer").val(),
					smtpPort: $("#smtpPort").val(),
					smtpProperties: $('input[name="smtpProperties"]').val(),
					smtpEmail: $('input[name="smtpEmail"]').val(),
					smtpAccount: $('input[name="smtpAccount"]').val(),
					smtpPassword: $('input[name="smtpPassword"]').val(),
					smtpActive: $('input[name="smtpActive"]:checked').val(),
					authenticationSPA: $('input[name="authenticationSPA"]:checked').val(),
					companyCode: dataCompanyCode
				},
				success: function(response) {
					if (response.status == 1) {
						$("#data_id").val(response.id)
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
				error: function(textStatus, error) {
					if (textStatus.responseJSON.status == 404) {
						window.location.href = "/404";
					} else {
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({'display':'none'});
						Swal.fire({
							title: 'Error!',
							text: textStatus.responseJSON.message,
							icon: 'error',
							customClass: {
								confirmButton: 'btn btn-primary'
							},
							buttonsStyling: false,
							timer: 1200
						});
						return false;
					}
				}
			});
		}
	});
}

if ($("#frm-send-email").length) {
	$("#frm-send-email").validate({
		errorClass: "help-block animation-slideDown error",
		errorElement: "div",
		errorPlacement: function(error, e) {
			e.parents(".form-group").append(error);
		},
		highlight: function(e) {
			$(e).removeClass("success error").addClass("error");
			$(e).closest(".help-block").remove();
		},
		success: function(e) {
			e.removeClass("success error");
			e.closest(".help-block").remove();
		},
		Submit: function() {
		},
		rules: {
			testEmail: {
				required: true,
				email: true
			},
			testSubject: {
				required: true
			},
			testContent: {
				required: true
			},
		},
		messages: {
			testEmail: {
				required : "Please enter email",
			},
			testSubject: {
				required : "Please enter subject",
			},
			testContent: {
				required : "Please enter content",
			},
		},
		submitHandler: function(e) {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({'display':'block'});

			let smtpServer = $("#smtpServer").val();
			let smtpEmail = $("#smtpEmail").val();
			let smtpAccount = $("#smtpAccount").val();
			let smtpPort = $("#smtpPort").val();
			let smtpProperties = $("input[name='smtpProperties']:checked").val();
			let smtpPassword = $("#smtpPassword").val();
			let authenticationSPA = $("input[name='authenticationSPA']:checked").val();

			let formData = new FormData($("#frm-send-email")[0]);
			formData.append("smtpServer", smtpServer);
			formData.append("smtpEmail", smtpEmail);
			formData.append("smtpAccount", smtpAccount);
			formData.append("smtpPort", smtpPort);
			formData.append("smtpProperties", smtpProperties);
			formData.append("smtpPassword", smtpPassword);
			formData.append("authenticationSPA", authenticationSPA);

			$.ajax({
				url: "/settings/test-email-smtp",
				method: "post",
				dataType: "json",
				data: formData,
				processData: false,
				contentType: false,
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
						$("#testEmail").val('');
						$("#testSubject").val('');
						$("#testContent").val('');
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
						$("#testEmail").val('');
						$("#testSubject").val('');
						$("#testContent").val('');
					}

					$('.overlay, body').addClass('loaded');
					$('.overlay').css({'display':'none'});
				},
				error: function(textStatus, error) {
					if (textStatus.responseJSON.status == 404) {
						window.location.href = "/404";
					} else {
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({'display':'none'});
						Swal.fire({
							title: 'Error!',
							text: textStatus.responseJSON.message,
							icon: 'error',
							customClass: {
								confirmButton: 'btn btn-primary'
							},
							buttonsStyling: false,
							timer: 1200
						});
						return false;
					}
				}
			});
		}
	});
}
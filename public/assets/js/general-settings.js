if ($("#frm-save-general-settings").length) {
	$.validator.addMethod("alphaOnly", function (value, element) {
		return this.optional(element) || /^[A-Za-z0-9]+$/.test(value);
	}, "Only alphabetic characters are allowed.");
	formValidator = $("#frm-save-general-settings").validate({
		errorClass: "help-block animation-slideDown error",
		errorElement: "div",
		errorPlacement: function (error, e) {
			e.parents(".form-group").append(error);
		},
		highlight: function (e) {
			$(e).removeClass("success error").addClass("error");
			$(e).closest(".help-block").remove();
		},
		success: function (e) {
			e.removeClass("success error");
			e.closest(".help-block").remove();
		},
		rules: {
			'default-project-prefix': {
				required: true,
				alphaOnly: true
			}
		},
		messages: {
			'default-project-prefix': {
				required: 'Please enter the Default Project Prefix!',
				alphaOnly: 'Only alphabetic characters are allowed!'
			}
		},
		submitHandler: function (e) {
			$('.overlay, body').removeClass('loaded');
			$('.overlay').css({ 'display': 'block' });
			let currentDataId = $("#data_id").val();
			let url = "/settings/save-general-settings";
			if (currentDataId != "") {
				url = "/settings/update-general-settings";
			}
			$.ajax({
				url: url,
				method: "post",
				dataType: "json",
				data: { data_id: currentDataId, enableLogs: $('input[name="enableLogs"]:checked').val(), enableFullLogs: $('input[name="enableFullLogs"]:checked').val(), defaultProjectPrefix: $('#default-project-prefix').val() || '/default', disableDefaultProjectPrefix: $('input[name="disableDefaultProjectPrefix"]:checked').val(), enableDiffCheck: $('input[name="enableDiffCheck"]:checked').val(), diffCheckReturnUrl: $('#diff-check-return-url').val() || '', companyCode: dataCompanyCode },
				success: function (response) {
					if (response.status == 1) {
						$("#data_id").val(response.id);
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
					$('.overlay').css({ 'display': 'none' });
				},
				error: function (textStatus, error) {
					if (textStatus.responseJSON.status == 404) {
						window.location.href = "/404";
					} else {
						$('.overlay, body').addClass('loaded');
						$('.overlay').css({ 'display': 'none' });
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
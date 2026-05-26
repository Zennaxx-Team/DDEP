let alertHistoryCurrentPage = 1;
let alertHistoryPerPage = 50;
let alertDetailCurrentPage = 1;
let alertDetailPerPage = 50;
let alertViewLogsTable = null;
let table = null;
let uniqueAlertId = null;
let uniqueLogId = null;
let alertResponseData = null;
let perPage = 50;
let currentPage = 1;
let viewLogsItemId = '';
let viewLogsType = '';
let viewLogsPerPage = 50;
let viewLogsCurrentPage = 1;
let resViewlogTotalRecords = 0;
let viewLogsTable = null;;
let viewNewLogsTable = null;
let emailLogsTable_log = null;
let responseData = [];
let alertFromDate = null,
    alertToDate = null;

$(document).ready(function () {

    if (!$('#alert-history-data-table').length) return;

    const timeOptions = {
        "30 minutes": 30,
        "60 minutes": 60,
        "3 hours": 180,
        "6 hours": 360,
        "12 hours": 720,
        "24 hours": 1440,
        "3 days": 4320,
        "7 days": 10080,
        "1 month": 43200,
        "3 months": 129600
    };

    const presetRanges = {};
    Object.entries(timeOptions).forEach(([label, minutes]) => {
        const end = moment().startOf('second');
        const start = moment(end).subtract(minutes, 'minutes');
        presetRanges[label] = [start, end];
    });

    // DEFAULT (only reason 3 months shows on refresh)
    const DEFAULT_LABEL = "3 months";
    let startMoment = moment().subtract(timeOptions[DEFAULT_LABEL], 'minutes').startOf('second');
    let endMoment = moment().startOf('second');

    let currentSelectedLabel = DEFAULT_LABEL

    $('#alertreportrange').daterangepicker({
        timePicker: true,
        timePicker24Hour: true,
        timePickerSeconds: true,
        startDate: startMoment,
        endDate: endMoment,
        autoUpdateInput: false,
        locale: { format: 'MMMM D, YYYY HH:mm:ss' },
        ranges: presetRanges
    }, dateCallback);

    function matchPresetLabel(start, end) {
        const diffMinutes = Math.round(end.diff(start, 'minutes'));

        for (const [label, minutes] of Object.entries(timeOptions)) {
            // Allow small difference because of seconds rounding
            if (Math.abs(diffMinutes - minutes) <= 5) {
                return label;
            }
        }
        return null;
    }

    function updateDisplay(start, end, matchedLabel) {
        if (matchedLabel) {
            currentSelectedLabel = matchedLabel;
            $('#alertreportrange span').text(matchedLabel);
            $('.since-time-alert').text(matchedLabel);

            $('.ranges li').removeClass('active');
            $('.ranges li').each(function () {
                if ($(this).text().trim() === matchedLabel) {
                    $(this).addClass('active');
                }
            });
        } else {
            currentSelectedLabel = null;
            const displayText = `${start.format('MMMM D, YYYY HH:mm:ss')} - ${end.format('MMMM D, YYYY HH:mm:ss')}`;
            $('#alertreportrange span').text(displayText);
            $('.since-time-alert').text('Custom Range');
        }
    }

    function dateCallback(start, end) {
        alertFromDate = start.toISOString();
        alertToDate = end.toISOString();
        alertHistoryCurrentPage = 1;

        const matchedLabel = matchPresetLabel(start, end);

        updateDisplay(start, end, matchedLabel);

        getAlertHistorycondition();
    }

    dateCallback(startMoment, endMoment);

    initAlertHistoryTable();

    $('#alertreportrange').on('apply.daterangepicker', function (ev, picker) {
        // If clicked on one of the ranges → we trust it's a preset
        const clickedLabel = picker.chosenLabel;

        if (clickedLabel && timeOptions[clickedLabel]) {
            // Force exact match behavior
            currentSelectedLabel = clickedLabel;
            updateDisplay(picker.startDate, picker.endDate, clickedLabel);
        } else {
            dateCallback(picker.startDate, picker.endDate);
        }

        getAlertHistorycondition();
    });

    function initAlertHistoryTable() {
        if ($.fn.DataTable.isDataTable('#alert-history-data-table')) return;

        table = $('#alert-history-data-table').DataTable({
            paging: false,
            searching: true,
            info: false,
            ordering: false,
            autoWidth: false,
            language: {
                emptyTable: "No data available"
            },
            initComplete: function () {
                $('#alert-history-data-table_filter input')
                    .off()
                    .on('keyup', function (e) {
                        if (e.keyCode === 13) {
                            alertHistoryCurrentPage = 1;
                            getAlertHistorycondition();
                        }
                    });
            }
        });
    }

    function getAlertHistorycondition() {
        initAlertHistoryTable();

        if (!alertFromDate || !alertToDate) return;

        $('#alert-history-data-table tbody').html(
            '<tr><td colspan="11"><div class="tableloader"></div></td></tr>'
        );

        $.ajax({
            url: '/alerts/alert-history/list',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                page: alertHistoryCurrentPage,
                limit: alertHistoryPerPage,
                search: $('#alert-history-data-table_filter input').val(),
                fromDate: alertFromDate,
                toDate: alertToDate
            }),
            success: function (response) {
                table.clear();

                let counter =
                    alertHistoryCurrentPage > 1
                        ? alertHistoryPerPage * (alertHistoryCurrentPage - 1) + 1
                        : 1;

                if (!response.data || !response.data.length) {
                    table.draw();
                    renderPagination(0);
                    return;
                }

                response.data.forEach(data => {
                    table.row.add([
                        counter++,
                        data?.policyName || '',
                        data?.conditionName || '',
                        data?.ruleName || '',
                        data?.notifyType || '',
                        data?.result || '',
                        data?.httpStatusCode || '',
                        dateFormat(data.startTime),
                        dateFormat(data.endTime),
                        data?.timeConsumedMs || '',
                        `<button class="btn btn-sm btn-outline-primary"
                            onclick="viewAlertHistoryDetails('${data._id}')">
                            View Details
                        </button>`
                    ]);
                });

                table.draw(false);
                renderPagination(response.total);
            },
            error: function (xhr) {
                Swal.fire({
                    title: 'Error!',
                    text: xhr?.responseJSON?.message || 'Something went wrong',
                    icon: 'error',
                    timer: 1200,
                    buttonsStyling: false,
                    customClass: { confirmButton: 'btn btn-primary' }
                });
            }
        });
    }

    function renderPagination(total) {
        const totalPages = Math.ceil(total / alertHistoryPerPage);
        let html = '';

        if (totalPages <= 1) {
            $('#alert-history-data-table_paginate').html('');
            return;
        }

        const prevDisabled = alertHistoryCurrentPage === 1 ? 'disabled' : '';
        const nextDisabled = alertHistoryCurrentPage === totalPages ? 'disabled' : '';

        html += `<a class="paginate_button ${prevDisabled}" data-pageno="${alertHistoryCurrentPage - 1}">Previous</a>`;

        for (let i = 1; i <= totalPages; i++) {
            html += i === alertHistoryCurrentPage
                ? `<a class="paginate_button current" data-pageno="${i}">${i}</a>`
                : `<a class="paginate_button" data-pageno="${i}">${i}</a>`;
        }

        html += `<a class="paginate_button ${nextDisabled}" data-pageno="${alertHistoryCurrentPage + 1}">Next</a>`;

        $('#alert-history-data-table_paginate').html(html);
    }

    $('body').on('click', '.paginate_button', function () {
        if ($(this).hasClass('disabled') || $(this).hasClass('current')) return;

        const page = $(this).data('pageno');
        if (!page) return;

        alertHistoryCurrentPage = parseInt(page);
        getAlertHistorycondition();
    });

    $('body').on('change', '#alert-history-data-table_length select', function () {
        alertHistoryPerPage = parseInt($(this).val());
        alertHistoryCurrentPage = 1;
        getAlertHistorycondition();
    });
});

if ($('#alert-logs-view-table').length) {
    alertDetailPerPage = 50;
    alertDetailCurrentPage = 1;
    initAlertLogsTable();

    $('body').on('click', '#alert-logs-view-table_paginate .paginate_button', async function () {
        alertDetailCurrentPage = $(this).attr('data-pageno');
        initAlertLogsTable();
        await getDetailAlertHistorycondition(parseInt(alertDetailPerPage), parseInt(alertDetailCurrentPage), uniqueAlertId);
    });

    $('body').on('change', '#alert-logs-view-table_length select', async function () {
        alertDetailPerPage = $('#alert-logs-view-table_length select').val();
        alertDetailCurrentPage = 1;
        initAlertLogsTable();
        await getDetailAlertHistorycondition(parseInt(alertDetailPerPage), parseInt(alertDetailCurrentPage), uniqueAlertId);
    });
}

function initAlertLogsTable() {
    if ($.fn.DataTable.isDataTable('#alert-logs-view-table')) {
        alertViewLogsTable = $('#alert-logs-view-table').DataTable();
        return;
    }

    alertViewLogsTable = $('#alert-logs-view-table').DataTable({
        aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
        iDisplayLength: alertDetailPerPage,
        pagingType: 'full_numbers',
        searching: true,
    });
}

async function getDetailAlertHistorycondition(alertDetailPerPage, alertDetailCurrentPage, uniqueAlertId) {
    $('#alert-logs-view-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');

    $.ajax({
        url: '/alerts/alert-history/get/' + uniqueAlertId,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ page: parseInt(alertDetailCurrentPage), limit: parseInt(alertDetailPerPage) }),
        success: function (response) {
            alertResponseData = response.data;
            let counter = (parseInt(alertDetailCurrentPage) > 1) ? ((parseInt(alertDetailPerPage) * (parseInt(alertDetailCurrentPage) - 1)) + 1) : 1;
            let totalRecord = parseInt(response.total);

            if (response.data === undefined || response.data.length <= 0) {
                $('#alert-logs-view-table tbody').html('<tr class="odd"><td valign="top" colspan="9" class="dataTables_empty">No data available in table</td></tr>');
            }

            alertViewLogsTable.clear();

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

                let $button_group = '<div class="btn-group" role="group" aria-label="Action Buttons">';
                if (data.datas && data.datas !== "") {
                    $button_group += '<button type="button" class="btn btn-outline-secondary view-details-btn" data-toggle="tooltip" title="View" data-alert-uniqueId="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
                }
                $button_group += '</div>';

                alertViewLogsTable.row.add([
                    counter++,
                    data.action,
                    data.description,
                    data.trigger_by,
                    data.httpStatus || '',
                    startTime,
                    $button_group
                ])
            });

            alertViewLogsTable.draw(false);

            $('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
            let startEntry = (parseInt(alertDetailCurrentPage) == 1) ? 1 : ((parseInt(alertDetailPerPage) * (parseInt(alertDetailCurrentPage) - 1)) + 1);
            let endEntry = (parseInt(alertDetailCurrentPage) == 1) ? parseInt(alertDetailPerPage) : (parseInt(alertDetailPerPage) * parseInt(alertDetailCurrentPage));
            endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

            if (totalRecord == 0) {
                startEntry = 0;
            }

            let showpage = 'Showing ' + startEntry + ' to ' + endEntry + ' of ' + totalRecord + ' entries';
            $('body').find('#alert-logs-view-table_info').html(showpage);

            let dataDtIdx = 0;
            let paginationHtml = '';
            let firstDisable = (parseInt(alertDetailCurrentPage) == 1) ? 'disabled' : '';
            let lastDisable = (parseInt(alertDetailCurrentPage) == Math.ceil(totalRecord / parseInt(alertDetailPerPage))) ? 'disabled' : '';

            if (Math.ceil(totalRecord / parseInt(alertDetailPerPage)) > 0) {
                paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="alert-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-logs-view-table_first_1" data-pageno="1">First</a>';
                dataDtIdx++;
                paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="alert-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-logs-view-table_previous_1" data-pageno="' + (parseInt(alertDetailCurrentPage) - 1) + '">Previous</a>';
                paginationHtml += '<span>';
                dataDtIdx++;

                if (parseInt(alertDetailCurrentPage) > 2) {
                    paginationHtml += '<a class="paginate_button" aria-controls="alert-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
                    if (parseInt(alertDetailCurrentPage) > 3) {
                        paginationHtml += '<span class="ellipsis">...</span>';
                    }
                    dataDtIdx++;
                }

                if ((parseInt(alertDetailCurrentPage) - 1) > 0) {
                    paginationHtml += '<a class="paginate_button" aria-controls="alert-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(alertDetailCurrentPage) - 1) + '">' + (parseInt(alertDetailCurrentPage) - 1) + '</a>';
                    dataDtIdx++;
                }

                paginationHtml += '<a class="paginate_button current" aria-controls="alert-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(alertDetailCurrentPage) + '">' + parseInt(alertDetailCurrentPage) + '</a>';
                dataDtIdx++;

                if ((parseInt(alertDetailCurrentPage) + 1) < Math.ceil(totalRecord / parseInt(alertDetailPerPage)) + 1) {
                    paginationHtml += '<a class="paginate_button" aria-controls="alert-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(alertDetailCurrentPage) + 1) + '">' + (parseInt(alertDetailCurrentPage) + 1) + '</a>';
                    dataDtIdx++;
                }

                if (parseInt(alertDetailCurrentPage) < Math.ceil(totalRecord / parseInt(alertDetailPerPage)) - 1) {
                    if (((parseInt(alertDetailCurrentPage) + 3) < Math.ceil(totalRecord / parseInt(alertDetailPerPage)) + 1)) {
                        paginationHtml += '<span class="ellipsis">...</span>';
                    }
                    paginationHtml += '<a class="paginate_button" aria-controls="alert-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(alertDetailPerPage)) + '">' + Math.ceil(totalRecord / parseInt(alertDetailPerPage)) + '</a>';
                    dataDtIdx++;
                }

                paginationHtml += '</span>';
                paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="alert-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-logs-view-table_next_1" data-pageno="' + (parseInt(alertDetailCurrentPage) + 1) + '">Next</a>';
                dataDtIdx++;
                paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="alert-logs-view-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="alert-logs-view-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(alertDetailPerPage)) + '">Last</a>';
            }

            $('body').find('#alert-logs-view-table_paginate').html(paginationHtml);
        },
        error: function (xhr, status, error) {
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

$('body').on('click', '.view-details-btn', function (event) {
    event.preventDefault();
    const uniqueId = $(this).data('uniqueid');
    $('#copy-content-btn').hide();
    if (!alertResponseData) {
        Swal.fire('Error', 'Data not loaded', 'error');
        return;
    }

    const dataObject = alertResponseData.find(item => item._id === uniqueId);
    if (!dataObject) return;

    let datas;
    try {
        datas = JSON.parse(dataObject.datas);
    } catch (e) {
        datas = dataObject.datas;
    }

    const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;
    $('#details-modal-body').show();
    $('#details-modal-body').text(formattedData);
    $('#view-item-logs-details-modal-slide-in').modal('show');
})

function viewAlertHistoryDetails(id) {
    if (!id) return;
    uniqueAlertId = id;
    $.ajax({
        url: '/alerts/alert-history/' + id,
        method: 'GET',
        success: function (response) {
            if (response.status !== 1) {
                $('#alert-history-modal-slide-in').modal('hide');
                Swal.fire('Error', response.message, 'error');
                return;
            }

            renderAlertHistoryDetail(response.data);
            $('#alert-history-modal-slide-in').modal('show');
        },
        error: function (xhr) {
            $('#alert-history-modal-slide-in').modal('hide');
            Swal.fire(
                'Error!',
                xhr?.responseJSON?.message || 'Failed to load alert history',
                'error'
            );
        }
    });
}

function renderAlertHistoryDetail(data) {
    $('.all-alert-rule').empty();
    $('#webhook-detail-container').empty();
    $('#email-detail-container').empty();

    // Update modal header
    $('#alert-modal-label-condition').text(
        `${data?.meta?.policyName || ''} - ${data?.meta?.conditionName || ''}`
    );

    const notifyType = data?.meta?.notifyType;
    let statusRow = '';

    if (notifyType === 'Email') {
        statusRow = `
        <tr>
            <th class="py-1 px-2">Email Status</th>
            <td class="py-1 px-2">
                ${data?.meta?.emailStatus || '-'}
            </td>
        </tr>
    `;
    } else {
        statusRow = `
        <tr>
            <th class="py-1 px-2">HTTP Status</th>
            <td class="py-1 px-2">
                ${data?.meta?.httpStatus || '-'}
            </td>
        </tr>
    `;
    }

    function getNotifyResult(data) {
        const notifyType = data?.meta?.notifyType;
        let isSuccess = false;

        // EMAIL LOGIC
        if (notifyType === 'Email') {
            if (data?.meta?.hasApiError) {
                isSuccess = false;
            } else if (data?.meta?.emailStatus.match("Success")) {
                isSuccess = true;
            } else if (data?.email?.error) {
                isSuccess = false;
            } else {
                isSuccess = false;
            }
        }

        // WEBHOOK LOGIC
        else if (notifyType === 'Webhook') {
            const httpStatus = Number(data?.meta?.httpStatus);

            if (data?.meta?.hasApiError) {
                isSuccess = false;
            } else if (httpStatus >= 200 && httpStatus <= 208) {
                isSuccess = true;
            } else if (!httpStatus) {
                isSuccess = false;
            } else {
                isSuccess = false;
            }
        }

        return {
            isSuccess,
            label: isSuccess ? 'Success' : 'Fail',
            badge: isSuccess ? 'success' : 'danger',
        };
    }

    const notifyResult = getNotifyResult(data);

    // Build HTML with proper spacing using Bootstrap classes
    let html = `
        <div class="mb-1 col-12 text-right">
            <span>
                <button type="button" class="btn btn-link p-0 m-0 me-1" onclick="viewHistoryLogDetails('${data?.meta?.log_unique_id}', '${data?.meta?.triggerBy}')">Source</button>
                <span class="mx-1">|</span>
            </span>
            <button type="button" class="btn btn-link p-0 m-0 ms-1" id="alert-details-page">Log Details</button>
        </div>
        <div class="col-12 mb-1">
            <table class="table table-bordered table-sm">
                <tr>
                    <th class="py-1 px-2" width="30%">Rule Name</th>
                    <td class="py-1 px-2">${data?.meta?.ruleName || '-'}</td>
                </tr>
                <tr>
                    <th class="py-1 px-2">Result</th>
                    <td class="py-1 px-2">
                        <span class="badge badge-${notifyResult.badge}">
                            ${notifyResult.label}
                        </span>
                    </td>
                </tr>
                ${statusRow}
                <tr>
                    <th class="py-1 px-2">Notify</th>
                    <td class="py-1 px-2">${data?.meta?.notifyType || '-'}</td>
                </tr>
                <tr>
                    <th class="py-1 px-2">Start Time</th>
                    <td class="py-1 px-2">${dateFormat(data?.meta?.startTime)}</td>
                </tr>
                <tr>
                    <th class="py-1 px-2">End Time</th>
                    <td class="py-1 px-2">${dateFormat(data?.meta?.endTime)}</td>
                </tr>
                <tr>
                    <th class="py-1 px-2">Time Consumed (ms)</th>
                    <td class="py-1 px-2">${data?.meta?.timeConsumedMs || '-'}</td>
                </tr>
            </table>
        </div>
    `;

    // Inject into modal section -> row
    $('#alert-history-modal-slide-in section .all-item').html(html);
    // XSS-safe helper

    // Dynamically create container
    function createAlertRulesContainer(parentSelector) {
        const $container = $(`
        <div class="alert-rules-container">
            <div id="alert-rules-root"></div>
        </div>
    `);
        $(parentSelector).append($container);
        return $container.find('#alert-rules-root');
    }

    function renderAlertRuleReport(report, $root) {
        $root.empty();
        buildAlertGroup(report, null, $root);
    }


    // Render report entry point
    function buildAlertGroup(groupData, parentGroupId, $root) {
        const groupId = 'alert-group-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const conditionClass = groupData.condition === 'OR' ? 'or' : '';
        const resultBadgeClass = groupData.result ? 'success' : 'danger';
        const resultLabel = groupData.result ? 'Success' : 'Fail';

        const groupHtml = `
        <div class="alert-group" id="${groupId}">
            <div class="group-header">
                <span class="group-condition ${conditionClass}">${groupData.condition}</span>
                <span class="group-result ${resultBadgeClass}">${resultLabel}</span>
            </div>
            <div class="group-table-header">
                <span>Monitor</span>
                <span>Actual</span>
                <span>Op</span>
                <span>Expected</span>
                <span>Resolved</span>
                <span>Result</span>
            </div>
            <div class="group-rules"></div>
        </div>
    `;

        if (parentGroupId) {
            $('#' + parentGroupId + ' > .group-rules').append(groupHtml);
        } else {
            $root.append(groupHtml);
        }

        groupData.rules.forEach(item => {
            if (item.type === 'group') {
                buildAlertGroup(item, groupId, $root);
            } else {
                buildAlertRule(item, groupId);
            }
        });
    }

    function buildAlertRule(rule, groupId) {
        const rowHtml = `
        <div class="rule-row">
            <span>${rule.monitor}</span>
            <span>${rule.actualValue}</span>
            <span>${rule.operation}</span>
            <span>${rule.expectedRaw}</span>
            <span>${rule.expectedResolved}</span>
            <span><span class="badge ${rule.result ? 'success' : 'danger'}">${rule.result ? 'Matched' : 'Not Matched'}</span></span>
        </div>
    `;
        $('#' + groupId + ' > .group-rules').append(rowHtml);
    }

    // ------------------- RENDER INSIDE MODAL -------------------
    if (data?.rule?.data) {
        const ruleData = typeof data.rule.data === 'string'
            ? JSON.parse(data.rule.data)
            : data.rule.data;

        if (ruleData?.report?.rules?.length) {
            const $alertRulesRoot = createAlertRulesContainer('#alert-history-modal-slide-in .all-alert-rule');
            renderAlertRuleReport(ruleData.report, $alertRulesRoot);
        } else {
            console.warn('No rules to display');
        }
    }

    $('#alert-sql-statement').text(data?.rule.sqlQuery || '-');
    $('#alert-sql-result-statement').text(data?.rule.sqlResult || '-');

    if (data?.webhook && Object.keys(data?.webhook).length > 0) {
        const webhook = data?.webhook;

        const tableHtml = `
            <div class="col-12">
                <h4>Webhook Detail</h4>

                <table class="table table-bordered table-sm mt-2">
                    <tbody>

                        <!-- Label row -->
                        <tr>
                            <th colspan="2" class="py-2 px-2">
                                <div class="d-flex justify-content-between align-items-start gap-2">
                                    <div class="flex-grow-1 text-break webhook-url">
                                        Webhook URL
                                    </div>
                                    <div class="text-nowrap">
                                       <div>
                                            <span class="hiddle_feilds">
                                                <button type="button"
                                                    class="btn btn-link p-0 m-0 me-1 request-copy"
                                                    data-request="">
                                                    Copy
                                                </button>
                                                <span class="mx-1">|</span>
                                                <button type="button"
                                                    class="btn btn-link p-0 m-0 mx-1 curl-alert-request-copy"
                                                    data-curl="">
                                                    Curl Bash
                                                </button>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </th>
                        </tr>

                        <!-- Full-width URL row -->
                        <tr>
                            <td class="py-1 px-2" colspan="2">
                                <span class="text-break">${escapeHtml(webhook.url)}</span>
                            </td>
                        </tr>

                        <!-- Normal 2-column rows -->
                        <tr>
                            <th class="py-1 px-2" width="25%">HTTP Status Code</th>
                            <td class="py-1 px-2">
                                ${data?.meta?.httpStatus || '-'}
                            </td>
                        </tr>

                    </tbody>
                </table>
            </div>
        `;

        $('#webhook-detail-container')
            .html(tableHtml)
            .show();

        const formattedData = typeof webhook?.curl === 'object' ? JSON.stringify(webhook?.curl, null, 4) : webhook?.curl;
        $('.request-copy').attr('data-request', formattedData);
        $('.curl-alert-request-copy').attr('data-curl', formattedData);

        let html = '';

        html += createJsonBlock('Querystrings', 'json-query');
        html += createJsonBlock('Headers', 'json-headers');
        html += createJsonBlock('Request Body', 'json-body');
        html += createJsonBlock('Response', 'json-response');

        $('#webhook-detail-container')
            .append(html)
            .show();

        // Parse safely
        const postData = typeof webhook?.postData === 'string'
            ? JSON.parse(webhook?.postData)
            : webhook?.postData;

        renderJsonWithLineNumbers(webhook?.query || {}, 'json-query');
        renderJsonWithLineNumbers(postData?.headers || {}, 'json-headers');
        renderJsonWithLineNumbers(postData?.data || {}, 'json-body');
        renderJsonWithLineNumbers(webhook?.response.body || {}, 'json-response');
    } else {
        $('#webhook-detail-container').empty();
        $('#webhook-detail-container').hide();
    }

    if (data?.email && Object.keys(data?.email).length > 0) {
        const email = data?.email;
        const tableHtml = `
            <div class="col-12">
                <h4>Email Detail</h4>

                <table class="table table-bordered table-sm mt-2">
                    <tbody>
                        <tr>
                            <th class="py-1 px-2" width="25%">Email To</th>
                            <td class="py-1 px-2">
                                ${email?.to || '-'}
                            </td>
                        </tr>
                        <tr>
                            <th class="py-1 px-2" width="25%">Email Subject</th>
                            <td class="py-1 px-2">
                                ${email?.subject || '-'}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        $('#email-detail-container')
            .html(tableHtml)
            .show();

        let html = '';

        // Code / JSON View
        html += createJsonBlock('Body (Code)', 'email-body');

        // HTML Preview FIRST
        html += createHtmlPreviewBlock('Body (Preview)', 'email-body-preview');

        if (email?.body) {
            $('#email-detail-container')
                .append(html)
                .show();
        }

        // Render HTML Preview
        if (email?.body) {
            $('#email-body-preview').html(email?.body);
        }

        // Render Code View
        renderJsonWithLineNumbers(email?.body || {}, 'email-body');
    } else {
        $('#email-detail-container').empty();
        $('#email-detail-container').hide();
    }

    $(document).on('click', '.json-copy-btn', function () {
        const targetId = $(this).data('target');
        const wrapper = $('#wrap-' + targetId);
        const text = wrapper.data('copy');

        if (!text) return;

        navigator.clipboard.writeText(text)
            .then(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'Copied',
                    text: 'JSON copied to clipboard',
                    timer: 1200,
                    showConfirmButton: false
                });
            })
            .catch(err => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message
                });
            });
    });

    $(document).on('click', '.request-copy', function () {
        const text = $(this).data('request');
        navigator.clipboard.writeText(text)
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

    $(document).on('click', '.curl-alert-request-copy', function () {
        let curlRequest = $(this).attr('data-curl');
        $('#alert-details-curl-base').text(curlRequest);
        $('#alert-history-curl-bash-model-slide-in').modal('show');
    });

    $(document).on('click', '#alert-details-page', async function () {
        initAlertLogsTable();
        await getDetailAlertHistorycondition(alertDetailPerPage, alertDetailCurrentPage, uniqueAlertId);
        $('#alert-logs-view-model-slide-in').modal('show');
    })

    $('#alert-copy-curl-btn').on('click', function () {
        let curlRequest = $('.curl-alert-request-copy').attr('data-curl');
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
                    timer: 20000
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
                    timer: 20000
                });
            });
    });
}

function createHtmlPreviewBlock(title, targetId) {
    return `
        <div class="json-block-wrapper mt-2 mb-1" id="wrap-${targetId}">
            <div class="json-title">
                <span>${title}</span>
            </div>
            <div class="p-3 border-top" id="${targetId}" style="background:#fff;">
                <!-- HTML preview will be injected here -->
            </div>
        </div>
    `;
}

function createJsonBlock(title, targetId, fullWidth = false) {
    return `
        <div class="json-block-wrapper mt-2 mb-1 ${fullWidth ? 'json-full' : ''}" id="wrap-${targetId}">
            <div class="json-title d-flex justify-content-between align-items-center">
                <span>${title}</span>

                <button type="button"
                    class="btn btn-sm btn-outline-secondary json-copy-btn"
                    data-target="${targetId}"
                    title="Copy JSON">
                    Copy
                </button>
            </div>

            <pre class="json-code">
                <code id="${targetId}"></code>
            </pre>
        </div>
    `;
}

function renderJsonWithLineNumbers(data, targetId) {
    const wrapper = $('#wrap-' + targetId);

    if (
        data === null ||
        data === undefined ||
        (typeof data === 'object' && Object.keys(data).length === 0) ||
        (typeof data === 'string' && data.trim() === '')
    ) {
        wrapper.hide();
        return;
    }

    wrapper.show();

    let formatted;
    let isJson = false;

    if (typeof data === 'string') {
        if (isValidJson(data)) {
            formatted = JSON.stringify(JSON.parse(data), null, 4);
            isJson = true;
        } else {
            formatted = data; // plain text
        }
    } else {
        formatted = JSON.stringify(data, null, 4);
        isJson = true;
    }

    // Store for copy
    wrapper.data('copy', formatted);

    // Split lines (JSON or text)
    const lines = formatted.split('\n');

    const html = lines
        .map(line => `<div class="json-line">${escapeHtml(line)}</div>`)
        .join('');

    $('#' + targetId).html(html);
}

function isValidJson(value) {
    if (typeof value !== 'string') return false;
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
}

function formatJson(value) {
    if (!value) return '-';

    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return JSON.stringify(parsed, null, 2);
    } catch {
        return value;
    }
}

// Helper to prevent XSS
function escapeHtml(text) {
    return $('<div>').text(text).html();
}

// SOURCE IMPLEMETATION

function initViewLogsTable() {
    if ($.fn.DataTable.isDataTable('#view-logs-data-table')) {
        viewLogsTable = $('#view-logs-data-table').DataTable();
        return;
    }

    viewLogsTable = $('#view-logs-data-table').DataTable({
        order: [[5, 'asc']],
        aLengthMenu: [[10, 20, 50, 100], [10, 20, 50, 100]],
        iDisplayLength: viewLogsPerPage,
        pagingType: 'full_numbers',
        searching: false,
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
}

function initNewViewLogsTable() {
    if ($.fn.DataTable.isDataTable('#view-new-logs-data-table')) {
        viewNewLogsTable = $('#view-new-logs-data-table').DataTable();
        return;
    }

    viewNewLogsTable = $('#view-new-logs-data-table').DataTable({
        ordering: false,
        paging: false,
        searching: false,
        info: false,
        lengthChange: false,
    });
}

function viewHistoryLogDetails(log_unique_id, triggerBy) {
    console.log(log_unique_id, 'log_unique_id', triggerBy, "triggerBy");
    initNewViewLogsTable();
    viewLogsItemId = log_unique_id;
    viewLogsType = triggerBy;
    getViewLogsData(viewLogsPerPage, viewLogsCurrentPage, viewLogsItemId, viewLogsType);
}

async function getViewLogsData(perPage, currentPage, uniqueId, logType) {
    $('.inbound-entrypoint-value').text('');
    if (logType === "Scheduler") {
        $('.overlay, body').removeClass('loaded');
        $('.overlay').css({ 'display': 'block' });
        $('#view-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');
        $('.hiddle_feilds').hide();
        await viewLogsforFtpView(perPage, currentPage, uniqueId, logType);
    } else {
        $('.overlay, body').removeClass('loaded');
        $('.overlay').css({ 'display': 'block' });
        $('#view-new-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty"><div class="tableloader"></div></td></tr>');
        $('.hiddle_feilds').show();
        await $.ajax({
            url: '/logs/logNewViewFullList',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ type: 'log', uniqueId }),
            success: function (response) {
                responseData = response.data;
                resViewlogTotalRecords = parseInt(response.total);
                viewNewLogsTable.clear();
                let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
                let totalRecord = parseInt(response.total);

                if (response.data.length <= 0) {
                    $('#view-new-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
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
                    let response_failure_url = "";
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
                    if (data.response_failure_url) { response_failure_url = data.response_failure_url }

                    let $button_group_request = '<div class="btn-group-vertical text-center" role="group">';
                    if (request?.datas) {
                        $button_group_request += createViewButtonForLogs(request.datas);
                    }
                    if (inboundMail?.length) {
                        $button_group_request += createEmailButtonForLogs(inboundMail);
                    }
                    $button_group_request += '</div>';

                    let $button_group_transformed_request = '';
                    $button_group_transformed_request = '<div class="btn-group-vertical text-center" role="group">';
                    if (transformed_request && transformed_request.datas) {
                        $button_group_transformed_request += createViewButtonForLogs(transformed_request.datas);
                    }
                    if (transformed_request && transformed_request.message) {
                        $button_group_transformed_request += `<span class="text-center mt-1 w-100">${transformed_request.message}</span>`;
                    }
                    $button_group_transformed_request += '</div>';

                    let $button_group_request_filter = '<div class="btn-group-vertical text-center" role="group">';
                    if (request_filter?.datas) {
                        $button_group_request_filter += createViewButtonForLogs(request_filter.datas);
                    }
                    if (request_filter?.message) {
                        $button_group_request_filter += `<span class="text-center mt-1 w-100">${request_filter.message}</span>`;
                    }
                    $button_group_request_filter += '</div>';

                    let $button_group_validation = '<div class="btn-group-vertical text-center" role="group">';
                    if (validation?.datas) {
                        $button_group_validation += createViewButtonForLogs(validation.datas);
                    }
                    if (validation?.message) {
                        $button_group_validation += `<span class="text-center mt-1 w-100">${validation.message}</span>`;
                    }
                    $button_group_validation += '</div>';

                    // Trigger Rule
                    let $button_group_trigger_rule = '<div class="btn-group-vertical text-center" role="group">';
                    if (trigger_rule?.datas) {
                        $button_group_trigger_rule += createViewButtonForLogs(trigger_rule.datas);
                    }
                    if (trigger_rule?.message) {
                        $button_group_trigger_rule += `<span class="text-center mt-1 w-100">${trigger_rule.message}</span>`;
                    }
                    $button_group_trigger_rule += '</div>';

                    // Request Return URL
                    let $button_group_request_return_url = '<div class="btn-group-vertical text-center" role="group">';
                    if (request_return_url?.datas) {
                        $button_group_request_return_url += createViewButtonForLogs(request_return_url.datas);
                    }
                    if (request_return_url?.message) {
                        $button_group_request_return_url += `<span class="text-center mt-1 w-100">${request_return_url.message}</span>`;
                    }
                    $button_group_request_return_url += '</div>';

                    // Curl Base
                    let $button_group_curl_base = '<div class="btn-group-vertical text-center" role="group">';
                    if (outbound_entrypoint?.datas) {
                        $button_group_curl_base += createViewButtonForLogs(outbound_entrypoint.datas, "curl");
                    }
                    if (outbound_entrypoint?.message) {
                        $button_group_curl_base += `<span class="text-center mt-1 w-100">${outbound_entrypoint.message}</span>`;
                    }
                    $button_group_curl_base += '</div>';


                    // Response
                    let $button_group_response = '<div class="btn-group-vertical text-center" role="group">';
                    if (response?.datas) {
                        $button_group_response += createViewButtonForLogs(response.datas);
                    }
                    if (outboundMail?.length) {
                        $button_group_response += createEmailButtonForLogs(outboundMail);
                    }
                    if (response?.message) {
                        $button_group_response += `<span class="text-center mt-1 w-100">${response.message}</span>`;
                    }
                    $button_group_response += '</div>';

                    // Transformed Response
                    let $button_group_transformed_response = '<div class="btn-group-vertical text-center" role="group">';
                    if (transformed_response?.datas) {
                        $button_group_transformed_response += createViewButtonForLogs(transformed_response.datas);
                    }
                    if (transformed_response?.message) {
                        $button_group_transformed_response += `<span class="text-center mt-1 w-100">${transformed_response.message}</span>`;
                    }
                    $button_group_transformed_response += '</div>';

                    // Response Filter
                    let $button_group_response_filter = '<div class="btn-group-vertical text-center" role="group">';
                    if (response_filter?.datas) {
                        $button_group_response_filter += createViewButtonForLogs(response_filter.datas);
                    }
                    if (response_filter?.message) {
                        $button_group_response_filter += `<span class="text-center mt-1 w-100">${response_filter.message}</span>`;
                    }
                    $button_group_response_filter += '</div>';

                    // Response Validation
                    let $button_group_response_validation = '<div class="btn-group-vertical text-center" role="group">';
                    if (response_validation?.datas) {
                        $button_group_response_validation += createViewButtonForLogs(response_validation.datas);
                    }
                    if (response_validation?.message) {
                        $button_group_response_validation += `<span class="text-center mt-1 w-100">${response_validation.message}</span>`;
                    }
                    $button_group_response_validation += '</div>';

                    // Response Return URL
                    let $button_group_response_return_url = '<div class="btn-group-vertical text-center" role="group">';
                    if (response_return_url?.datas) {
                        $button_group_response_return_url += createViewButtonForLogs(response_return_url.datas);
                    }
                    if (response_return_url?.message) {
                        $button_group_response_return_url += `<span class="text-center mt-1 w-100">${response_return_url.message}</span>`;
                    }
                    $button_group_response_return_url += '</div>';

                    // Response Failure Return URL
                    let $button_group_response_failure_return_url = '<div class="btn-group-vertical text-center" role="group">';
                    if (response_failure_url?.datas) {
                        $button_group_response_failure_return_url += createViewButtonForLogs(response_failure_url.datas);
                    }
                    if (response_failure_url?.message) {
                        $button_group_response_failure_return_url += `<span class="text-center mt-1 w-100">${response_failure_url.message}</span>`;
                    }
                    $button_group_response_failure_return_url += '</div>';

                    // Add row to DataTable matching the 15 columns you provided
                    viewNewLogsTable.row.add([
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
                        $button_group_response_return_url,    // RESPONSE RETURN URL
                        $button_group_response_failure_return_url
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
}

async function viewLogsforFtpView(perPage, currentPage, uniqueId, logType) {
    viewNewLogsTable.clear();
    await $.ajax({
        url: '/logs/logNewViewFullListForftp',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ type: 'log', uniqueId }),
        success: function (response) {
            responseData = response.data;
            resViewlogTotalRecords = parseInt(response.total);
            let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;

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
                let response_failure_url = "";
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
                if (data.response_failure_url) { response_failure_url = data.response_failure_url }

                let $button_group_request = '<div class="btn-group-vertical text-center" role="group">';
                if (request?.datas) {
                    $button_group_request += createViewButtonForLogs(request.datas);
                }
                if (inboundMail?.length) {
                    $button_group_request += createEmailButtonForLogs(inboundMail);
                }
                $button_group_request += '</div>';

                let $button_group_transformed_request = '';
                $button_group_transformed_request = '<div class="btn-group-vertical text-center" role="group">';
                if (transformed_request && transformed_request.datas) {
                    $button_group_transformed_request += createViewButtonForLogs(transformed_request.datas);
                }
                if (transformed_request && transformed_request.message) {
                    $button_group_transformed_request += `<span class="text-center mt-1 w-100">${transformed_request.message}</span>`;
                }
                $button_group_transformed_request += '</div>';

                let $button_group_request_filter = '<div class="btn-group-vertical text-center" role="group">';
                if (request_filter?.datas) {
                    $button_group_request_filter += createViewButtonForLogs(request_filter.datas);
                }
                if (request_filter?.message) {
                    $button_group_request_filter += `<span class="text-center mt-1 w-100">${request_filter.message}</span>`;
                }
                $button_group_request_filter += '</div>';

                let $button_group_validation = '<div class="btn-group-vertical text-center" role="group">';
                if (validation?.datas) {
                    $button_group_validation += createViewButtonForLogs(validation.datas);
                }
                if (validation?.message) {
                    $button_group_validation += `<span class="text-center mt-1 w-100">${validation.message}</span>`;
                }
                $button_group_validation += '</div>';

                // Trigger Rule
                let $button_group_trigger_rule = '<div class="btn-group-vertical text-center" role="group">';
                if (trigger_rule?.datas) {
                    $button_group_trigger_rule += createViewButtonForLogs(trigger_rule.datas);
                }
                if (trigger_rule?.message) {
                    $button_group_trigger_rule += `<span class="text-center mt-1 w-100">${trigger_rule.message}</span>`;
                }
                $button_group_trigger_rule += '</div>';

                // Request Return URL
                let $button_group_request_return_url = '<div class="btn-group-vertical text-center" role="group">';
                if (request_return_url?.datas) {
                    $button_group_request_return_url += createViewButtonForLogs(request_return_url.datas);
                }
                if (request_return_url?.message) {
                    $button_group_request_return_url += `<span class="text-center mt-1 w-100">${request_return_url.message}</span>`;
                }
                $button_group_request_return_url += '</div>';

                // Curl Base
                let $button_group_curl_base = '<div class="btn-group-vertical text-center" role="group">';
                if (outbound_entrypoint?.datas) {
                    $button_group_curl_base += createViewButtonForLogs(outbound_entrypoint.datas, "curl");
                }
                if (outbound_entrypoint?.message) {
                    $button_group_curl_base += `<span class="text-center mt-1 w-100">${outbound_entrypoint.message}</span>`;
                }
                $button_group_curl_base += '</div>';


                // Response
                let $button_group_response = '<div class="btn-group-vertical text-center" role="group">';
                if (response?.datas) {
                    $button_group_response += createViewButtonForLogs(response.datas);
                    $button_group_response += createEmailButtonForLogs(outboundMail);
                }
                if (response?.message) {
                    $button_group_response += `<span class="text-center mt-1 w-100">${response.message}</span>`;
                }
                $button_group_response += '</div>';

                // Transformed Response
                let $button_group_transformed_response = '<div class="btn-group-vertical text-center" role="group">';
                if (transformed_response?.datas) {
                    $button_group_transformed_response += createViewButtonForLogs(transformed_response.datas);
                }
                if (transformed_response?.message) {
                    $button_group_transformed_response += `<span class="text-center mt-1 w-100">${transformed_response.message}</span>`;
                }
                $button_group_transformed_response += '</div>';

                // Response Filter
                let $button_group_response_filter = '<div class="btn-group-vertical text-center" role="group">';
                if (response_filter?.datas) {
                    $button_group_response_filter += createViewButtonForLogs(response_filter.datas);
                }
                if (response_filter?.message) {
                    $button_group_response_filter += `<span class="text-center mt-1 w-100">${response_filter.message}</span>`;
                }
                $button_group_response_filter += '</div>';

                // Response Validation
                let $button_group_response_validation = '<div class="btn-group-vertical text-center" role="group">';
                if (response_validation?.datas) {
                    $button_group_response_validation += createViewButtonForLogs(response_validation.datas);
                }
                if (response_validation?.message) {
                    $button_group_response_validation += `<span class="text-center mt-1 w-100">${response_validation.message}</span>`;
                }
                $button_group_response_validation += '</div>';

                // Response Return URL
                let $button_group_response_return_url = '<div class="btn-group-vertical text-center" role="group">';
                if (response_return_url?.datas) {
                    $button_group_response_return_url += createViewButtonForLogs(response_return_url.datas);
                }
                if (response_return_url?.message) {
                    $button_group_response_return_url += `<span class="text-center mt-1 w-100">${response_return_url.message}</span>`;
                }
                $button_group_response_return_url += '</div>';

                // Response Failure Return URL
                let $button_group_response_failure_return_url = '<div class="btn-group-vertical text-center" role="group">';
                if (response_failure_url?.datas) {
                    $button_group_response_failure_return_url += createViewButtonForLogs(response_failure_url.datas);
                }
                if (response_failure_url?.message) {
                    $button_group_response_failure_return_url += `<span class="text-center mt-1 w-100">${response_failure_url.message}</span>`;
                }
                $button_group_response_failure_return_url += '</div>';


                // Add row to DataTable matching the 15 columns you provided
                viewNewLogsTable.row.add([
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
                    $button_group_response_return_url,    // RESPONSE RETURN URL
                    $button_group_response_failure_return_url
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

async function viewLogsPaginaiton(perPage, currentPage, totalRecord) {
    $('body').find('.paginate_button').addClass('btn m-10 btn-sm btn-outline-primary p-10');
    let startEntry = (parseInt(currentPage) == 1) ? 1 : ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1);
    let endEntry = (parseInt(currentPage) == 1) ? parseInt(perPage) : (parseInt(perPage) * parseInt(currentPage));
    endEntry = (endEntry > totalRecord) ? totalRecord : endEntry;

    if (totalRecord == 0) {
        startEntry = 0;
    }

    const showpage = `Showing ${startEntry} to ${endEntry} of ${totalRecord} entries`;
    $('body').find('#view-logs-data-table_info').html(showpage);

    let dataDtIdx = 0;
    let paginationHtml = '';
    let firstDisable = (parseInt(currentPage) == 1) ? 'disabled' : '';
    let lastDisable = (parseInt(currentPage) == Math.ceil(totalRecord / parseInt(perPage))) ? 'disabled' : '';

    if (Math.ceil(totalRecord / parseInt(perPage)) > 0) {
        paginationHtml += '<a class="paginate_button first ' + firstDisable + '" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="view-logs-data-table_first_1" data-pageno="1">First</a>';
        dataDtIdx++;
        paginationHtml += '<a class="paginate_button previous ' + firstDisable + '" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="view-logs-data-table_previous_1" data-pageno="' + (parseInt(currentPage) - 1) + '">Previous</a>';
        paginationHtml += '<span>';
        dataDtIdx++;

        if (parseInt(currentPage) > 2) {
            paginationHtml += '<a class="paginate_button" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="1">1</a>';
            if (parseInt(currentPage) > 3) {
                paginationHtml += '<span class="ellipsis">...</span>';
            }
            dataDtIdx++;
        }

        if ((parseInt(currentPage) - 1) > 0) {
            paginationHtml += '<a class="paginate_button" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) - 1) + '">' + (parseInt(currentPage) - 1) + '</a>';
            dataDtIdx++;
        }

        paginationHtml += '<a class="paginate_button current" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + parseInt(currentPage) + '">' + parseInt(currentPage) + '</a>';
        dataDtIdx++;

        if ((parseInt(currentPage) + 1) < Math.ceil(totalRecord / parseInt(perPage)) + 1) {
            paginationHtml += '<a class="paginate_button" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + (parseInt(currentPage) + 1) + '">' + (parseInt(currentPage) + 1) + '</a>';
            dataDtIdx++;
        }

        if (parseInt(currentPage) < Math.ceil(totalRecord / parseInt(perPage)) - 1) {
            if (((parseInt(currentPage) + 3) < Math.ceil(totalRecord / parseInt(perPage)) + 1)) {
                paginationHtml += '<span class="ellipsis">...</span>';
            }
            paginationHtml += '<a class="paginate_button" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">' + Math.ceil(totalRecord / parseInt(perPage)) + '</a>';
            dataDtIdx++;
        }

        paginationHtml += '</span>';
        paginationHtml += '<a class="paginate_button next ' + lastDisable + '" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="view-logs-data-table_next_1" data-pageno="' + (parseInt(currentPage) + 1) + '">Next</a>';
        dataDtIdx++;
        paginationHtml += '<a class="paginate_button last ' + lastDisable + '" aria-controls="view-logs-data-table" data-dt-idx="' + dataDtIdx + '" tabindex="0" id="view-logs-data-table_last_1" data-pageno="' + Math.ceil(totalRecord / parseInt(perPage)) + '">Last</a>';
    }

    $('body').find('#view-logs-data-table_paginate').html(paginationHtml);
}

if (viewLogsTable) {
    viewLogsTable.on('draw', function () {
        const perPage = viewLogsTable.page.info().length;
        viewLogsPaginaiton(perPage, viewLogsCurrentPage, resViewlogTotalRecords);
    });
}

$('body').on('click', '#view-logs-data-table_paginate .paginate_button', function () {
    viewLogsCurrentPage = $(this).attr('data-pageno');
    if ($.fn.DataTable.isDataTable('#view-logs-data-table')) {
        $('#view-logs-data-table').DataTable().clear().destroy();
    }
    oldViewLogData(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId);
});

$('body').on('change', '#view-logs-data-table_length select', function () {
    viewLogsPerPage = $('#view-logs-data-table_length select').val();
    viewLogsCurrentPage = 1;
    if ($.fn.DataTable.isDataTable('#view-logs-data-table')) {
        $('#view-logs-data-table').DataTable().clear().destroy();
    }
    oldViewLogData(parseInt(viewLogsPerPage), parseInt(viewLogsCurrentPage), viewLogsItemId);
});

$('body').on('click', 'button[data-alert-uniqueId]', function (event) {
    event.preventDefault();
    const uniqueId = $(this).attr('data-alert-uniqueId');
    const dataObject = alertResponseData.find(item => item._id === uniqueId);
    let datas;
    try {
        datas = JSON.parse(dataObject.datas);
    } catch (e) {
        datas = dataObject.datas;
    }
    const formattedData = typeof datas === 'object' ? JSON.stringify(datas, null, 4) : datas;
    $('#details-modal-body').text(formattedData);
    if (dataObject?.description == "User Posting Data" || dataObject?.description == "Mapped Data" || dataObject?.description == "Response Data" || dataObject.description == "CURL Bash") {
        $('#copy-content-btn').show();
    } else {
        $('#copy-content-btn').hide();
    }
    $('#log-req-res-request').attr('data-uniqueid-curl-request', formattedData);
    $('#details-modal-body').show();
    $('#table-content').hide();
    $('#view-item-logs-details-modal-slide-in').modal('show');
});

$('body').on('click', 'button[data-uniqueId]', function (event) {
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
    $('#details-modal-body').text(formattedData);
    if (dataObject?.description == "User Posting Data" || dataObject?.description == "Mapped Data" || dataObject?.description == "Response Data" || dataObject.description == "CURL Bash") {
        $('#copy-content-btn').show();
    } else {
        $('#copy-content-btn').hide();
    }
    $('#log-req-res-request').attr('data-uniqueid-curl-request', formattedData);
    $('#details-modal-body').show();
    $('#table-content').hide();
    $('#view-item-logs-details-modal-slide-in').modal('show');
});

$('#log-details-page').on('click', function () {
    let uniqueId = $(this).attr('data-uniqueid-log');
    resetLogViews();
    oldViewLogData(viewLogsPerPage, viewLogsCurrentPage, uniqueId)
});

$('#log-curl-request').on('click', function () {
    let curlRequest = $(this).attr('data-uniqueid-curl-request');
    $('#details-curl-base').text(curlRequest);
    $('#view-curl-bash-slide-in').modal('show');
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
                timer: 20000
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
                timer: 20000
            });
        });
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

function resetLogViews() {
    $('#view-new-item-logs-modal-slide-in').modal('show');
    $('.overlay, body').removeClass('loaded');
    $('.overlay').css({ 'display': 'block' });
    if ($.fn.DataTable.isDataTable('#view-logs-data-table')) {
        $('#view-logs-data-table').DataTable().clear().destroy();
    }
    $('#view-logs-data-table tbody').empty();
    if (emailLogsTable_log) {
        $("#table-content").empty();
        emailLogsTable_log.clear().draw();
    }
    viewLogsItemId = null;
    viewLogsType = null;
    viewLogsPerPage = 50;
    viewLogsCurrentPage = 1;
}

async function oldViewLogData(perPage, currentPage, uniqueId) {
    initViewLogsTable();
    await $.ajax({
        url: '/logs/logViewFullList',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ page: parseInt(currentPage), limit: parseInt(perPage), type: 'log', uniqueId }),
        success: function (response) {
            responseData = response.data;
            resViewlogTotalRecords = parseInt(response.total);
            let counter = (parseInt(currentPage) > 1) ? ((parseInt(perPage) * (parseInt(currentPage) - 1)) + 1) : 1;
            let totalRecord = parseInt(response.total);

            if (response.data.length <= 0) {
                $('#view-logs-data-table tbody').html('<tr class="odd"><td valign="top" colspan="7" class="dataTables_empty">No data available in table</td></tr>');
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

                let $button_group = '<div class="btn-group" role="group" aria-label="Action Buttons">';
                if (data.datas && data.datas !== "") {
                    $button_group += '<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="View" data-uniqueId="' + data._id + '"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>';
                }
                $button_group += '</div>';

                viewLogsTable.row.add([
                    counter++,
                    data.action,
                    data.description,
                    data.type,
                    data.httpStatus || '',
                    startTime,
                    $button_group
                ])
            });

            viewLogsTable.draw(false);
            viewLogsPaginaiton(perPage, currentPage, totalRecord)
            viewLogsItemId = uniqueId;
            $('#view-item-logs-modal-slide-in').modal('show');
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


function createViewButtonForLogs(datas, request) {
    if (!datas) return '';

    let parsedDatas;
    try {
        parsedDatas = typeof datas === 'string' ? JSON.parse(datas) : datas;
    } catch (e) {
        parsedDatas = datas;
    }

    // Safely stringify and escape quotes for HTML attribute
    const requestJson = JSON.stringify(parsedDatas).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    return `<button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" title="View" data-request='${requestJson}' data-curl='${request}' onclick="viewItemLogDetailsModelForLogs(this.getAttribute('data-request'), this.getAttribute('data-curl'))">
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>`;
}

function createEmailButtonForLogs(datas) {
    if (!datas) return '';
    return `<button type="button" class="btn btn-outline-secondary mt-1" data-toggle="tooltip" title="View" data-request='${JSON.stringify(datas)}' onclick="viewEmailLogDetailsForLogs(this.getAttribute('data-request'))">
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

function viewItemLogDetailsModelForLogs(datasString, curl) {
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
        $('#view-item-logs-details-modal-slide-in').modal('show');
    }
}

function viewEmailLogDetailsForLogs(emailLogs) {
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
    emailLogsTable_log = $('#email-logs-table').DataTable({
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

        emailLogsTable_log.row.add([
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
    $('#view-item-logs-details-modal-slide-in').modal('show');
}

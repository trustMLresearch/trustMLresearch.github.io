/* Keep each historical timetable's date format and midnight behavior. */
(function () {
    const options = document.currentScript.dataset;
    const pad = value => (value < 10 ? '0' : '') + value;
    const padDay = options.padDay === 'true';
    const adjustMidnight = options.adjustMidnight === 'true';
    const displayYear = options.year;

    window.getTimezone = function () {
        const offset = -(new Date()).getTimezoneOffset() / 60;
        return 'UTC' + (offset >= 0 ? '+' : '') + offset;
    };
    window.getLocalTimezone = function () {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone + ' time (' + getTimezone() + ", your browser's time zone)";
        } catch (error) {
            return ' (' + getTimezone() + ", i.e., your browser's time zone)";
        }
    };
    window.displayTime = date => pad(date.getHours()) + ':' + pad(date.getMinutes());
    window.displayDate = date => pad(date.getDate());
    window.displayMonth = date => pad(date.getMonth() + 1);

    window.writeTimeRange = function (year, month, day, startHour, startMin, endHour, endMin) {
        const date = year + '-' + pad(month) + '-' + pad(day) + 'T';
        let reference = new Date(date + startHour + ':' + pad(startMin) + ':00.000+09:00');
        const midnight = new Date(date + '00:00:00.000+09:00');
        const start = new Date(midnight.getTime() + (startHour * 60 + startMin) * 60000);
        const end = new Date(midnight.getTime() + (endHour * 60 + endMin) * 60000);
        if (adjustMidnight && end.getDay() !== reference.getDay()) {
            reference = new Date(date + '10:00:00.000+09:00');
        }
        const dayText = padDay ? displayDate(reference) : reference.getDate();
        const nextDay = end.getDay() !== reference.getDay() ? ' (next day)' : '';
        document.write(displayTime(start) + '-' + displayTime(end) + ' ' + dayText + '/' + displayMonth(reference) + '/' + displayYear + nextDay);
    };
})();

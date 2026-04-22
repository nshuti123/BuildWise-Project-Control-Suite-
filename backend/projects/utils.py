from datetime import timedelta

def add_working_days(start_date, working_days):
    """
    Adds a given number of working days to the start_date, skipping weekends.
    If working_days is 1, the task ends on the start_date (duration of 1 day).
    Saturday = 5, Sunday = 6 in Python's weekday().
    """
    if not start_date or working_days <= 0:
        return start_date

    days_to_add = working_days - 1
    current_date = start_date

    while days_to_add > 0:
        current_date += timedelta(days=1)
        if current_date.weekday() < 5:  # Monday to Friday
            days_to_add -= 1

    return current_date

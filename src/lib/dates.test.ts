import { describe, it, expect } from "vitest";
import {
	parseDate,
	formatDate,
	isWeekday,
	addDays,
	getWorkingDays,
	getDays,
	daysBetween,
	toWorkingDay,
	addWorkingDays,
	workingDaysBetween,
	getMonday,
	getWeeks,
	formatShortDate,
	formatMonthYear,
	formatDayName,
	today,
} from "./dates";

describe("parseDate", () => {
	it("should parse a date string correctly", () => {
		const date = parseDate("2024-03-15");
		expect(date.getFullYear()).toBe(2024);
		expect(date.getMonth()).toBe(2);
		expect(date.getDate()).toBe(15);
	});

	it("should handle single digit months and days", () => {
		const date = parseDate("2024-1-5");
		expect(date.getFullYear()).toBe(2024);
		expect(date.getMonth()).toBe(0);
		expect(date.getDate()).toBe(5);
	});

	it("should handle leap year dates", () => {
		const date = parseDate("2024-02-29");
		expect(date.getFullYear()).toBe(2024);
		expect(date.getMonth()).toBe(1);
		expect(date.getDate()).toBe(29);
	});
});

describe("formatDate", () => {
	it("should format a date correctly", () => {
		const date = new Date(2024, 2, 15);
		expect(formatDate(date)).toBe("2024-03-15");
	});

	it("should pad single digit months and days", () => {
		const date = new Date(2024, 0, 5);
		expect(formatDate(date)).toBe("2024-01-05");
	});

	it("should handle end of year", () => {
		const date = new Date(2024, 11, 31);
		expect(formatDate(date)).toBe("2024-12-31");
	});
});

describe("isWeekday", () => {
	it("should return true for Monday", () => {
		const monday = new Date(2024, 2, 18);
		expect(isWeekday(monday)).toBe(true);
	});

	it("should return true for Friday", () => {
		const friday = new Date(2024, 2, 15);
		expect(isWeekday(friday)).toBe(true);
	});

	it("should return false for Saturday", () => {
		const saturday = new Date(2024, 2, 16);
		expect(isWeekday(saturday)).toBe(false);
	});

	it("should return false for Sunday", () => {
		const sunday = new Date(2024, 2, 17);
		expect(isWeekday(sunday)).toBe(false);
	});

	it("should return true for Wednesday", () => {
		const wednesday = new Date(2024, 2, 13);
		expect(isWeekday(wednesday)).toBe(true);
	});
});

describe("addDays", () => {
	it("should add positive days", () => {
		const date = new Date(2024, 2, 15);
		const result = addDays(date, 5);
		expect(result.getDate()).toBe(20);
	});

	it("should add negative days", () => {
		const date = new Date(2024, 2, 15);
		const result = addDays(date, -5);
		expect(result.getDate()).toBe(10);
	});

	it("should handle month transitions", () => {
		const date = new Date(2024, 2, 30);
		const result = addDays(date, 2);
		expect(result.getMonth()).toBe(3);
		expect(result.getDate()).toBe(1);
	});

	it("should not modify original date", () => {
		const date = new Date(2024, 2, 15);
		const originalDate = date.getDate();
		addDays(date, 5);
		expect(date.getDate()).toBe(originalDate);
	});
});

describe("getWorkingDays", () => {
	it("should return only weekdays", () => {
		const start = new Date(2024, 2, 15); // Friday
		const end = new Date(2024, 2, 18); // Monday
		const workingDays = getWorkingDays(start, end);
		expect(workingDays.length).toBe(2); // Friday and Monday
	});

	it("should return empty array if end is before start", () => {
		const start = new Date(2024, 2, 18);
		const end = new Date(2024, 2, 15);
		const workingDays = getWorkingDays(start, end);
		expect(workingDays.length).toBe(0);
	});

	it("should handle a full week", () => {
		const start = new Date(2024, 2, 11); // Monday
		const end = new Date(2024, 2, 17); // Sunday
		const workingDays = getWorkingDays(start, end);
		expect(workingDays.length).toBe(5);
	});

	it("should include start and end dates if they are weekdays", () => {
		const start = new Date(2024, 2, 11); // Monday
		const end = new Date(2024, 2, 15); // Friday
		const workingDays = getWorkingDays(start, end);
		expect(workingDays.length).toBe(5);
	});
});

describe("getDays", () => {
	it("should return all days including weekends", () => {
		const start = new Date(2024, 2, 15); // Friday
		const end = new Date(2024, 2, 18); // Monday
		const days = getDays(start, end);
		expect(days.length).toBe(4);
	});

	it("should return single day when start equals end", () => {
		const start = new Date(2024, 2, 15);
		const end = new Date(2024, 2, 15);
		const days = getDays(start, end);
		expect(days.length).toBe(1);
	});

	it("should return empty array if end is before start", () => {
		const start = new Date(2024, 2, 18);
		const end = new Date(2024, 2, 15);
		const days = getDays(start, end);
		expect(days.length).toBe(0);
	});
});

describe("daysBetween", () => {
	it("should calculate days between dates", () => {
		const start = new Date(2024, 2, 15);
		const end = new Date(2024, 2, 20);
		expect(daysBetween(start, end)).toBe(5);
	});

	it("should return 0 for same date", () => {
		const date = new Date(2024, 2, 15);
		expect(daysBetween(date, date)).toBe(0);
	});

	it("should return negative for reversed dates", () => {
		const start = new Date(2024, 2, 20);
		const end = new Date(2024, 2, 15);
		expect(daysBetween(start, end)).toBe(-5);
	});

	it("should handle year boundaries", () => {
		const start = new Date(2023, 11, 31);
		const end = new Date(2024, 0, 2);
		expect(daysBetween(start, end)).toBe(2);
	});
});

describe("toWorkingDay", () => {
	it("should return same date for weekday", () => {
		const monday = new Date(2024, 2, 18);
		const result = toWorkingDay(monday);
		expect(result.getDate()).toBe(18);
	});

	it("should move Saturday to Monday", () => {
		const saturday = new Date(2024, 2, 16);
		const result = toWorkingDay(saturday);
		expect(result.getDate()).toBe(18);
		expect(isWeekday(result)).toBe(true);
	});

	it("should move Sunday to Monday", () => {
		const sunday = new Date(2024, 2, 17);
		const result = toWorkingDay(sunday);
		expect(result.getDate()).toBe(18);
		expect(isWeekday(result)).toBe(true);
	});

	it("should not modify original date", () => {
		const saturday = new Date(2024, 2, 16);
		const originalDate = saturday.getDate();
		toWorkingDay(saturday);
		expect(saturday.getDate()).toBe(originalDate);
	});
});

describe("addWorkingDays", () => {
	it("should add working days skipping weekends", () => {
		const friday = new Date(2024, 2, 15);
		const result = addWorkingDays(friday, 3);
		expect(result.getDate()).toBe(20); // Monday + 2 days = Wednesday
	});

	it("should subtract working days", () => {
		const monday = new Date(2024, 2, 18);
		const result = addWorkingDays(monday, -3);
		expect(result.getDate()).toBe(13); // Previous Wednesday
	});

	it("should return same date for 0 days", () => {
		const date = new Date(2024, 2, 15);
		const result = addWorkingDays(date, 0);
		expect(result.getDate()).toBe(15);
	});

	it("should handle adding 1 working day from Friday", () => {
		const friday = new Date(2024, 2, 15);
		const result = addWorkingDays(friday, 1);
		expect(result.getDate()).toBe(18); // Monday
	});

	it("should handle adding 5 working days (1 week)", () => {
		const monday = new Date(2024, 2, 11);
		const result = addWorkingDays(monday, 5);
		expect(result.getDate()).toBe(18); // Next Monday
	});
});

describe("workingDaysBetween", () => {
	it("should count working days between dates", () => {
		const start = new Date(2024, 2, 11); // Monday
		const end = new Date(2024, 2, 15); // Friday
		expect(workingDaysBetween(start, end)).toBe(5);
	});

	it("should exclude weekends", () => {
		const start = new Date(2024, 2, 15); // Friday
		const end = new Date(2024, 2, 18); // Monday
		expect(workingDaysBetween(start, end)).toBe(2);
	});

	it("should return 1 for same working day", () => {
		const date = new Date(2024, 2, 15); // Friday
		expect(workingDaysBetween(date, date)).toBe(1);
	});

	it("should return 0 for weekend single day", () => {
		const saturday = new Date(2024, 2, 16);
		expect(workingDaysBetween(saturday, saturday)).toBe(0);
	});
});

describe("getMonday", () => {
	it("should return same date for Monday", () => {
		const monday = new Date(2024, 2, 18);
		const result = getMonday(monday);
		expect(result.getDate()).toBe(18);
	});

	it("should return previous Monday for Friday", () => {
		const friday = new Date(2024, 2, 15);
		const result = getMonday(friday);
		expect(result.getDate()).toBe(11);
	});

	it("should return previous Monday for Sunday", () => {
		const sunday = new Date(2024, 2, 17);
		const result = getMonday(sunday);
		expect(result.getDate()).toBe(11);
	});

	it("should return previous Monday for Saturday", () => {
		const saturday = new Date(2024, 2, 16);
		const result = getMonday(saturday);
		expect(result.getDate()).toBe(11);
	});

	it("should return previous Monday for Wednesday", () => {
		const wednesday = new Date(2024, 2, 13);
		const result = getMonday(wednesday);
		expect(result.getDate()).toBe(11);
	});
});

describe("getWeeks", () => {
	it("should return weeks between dates", () => {
		const start = new Date(2024, 2, 11); // Monday
		const end = new Date(2024, 2, 25); // Monday, 2 weeks later
		const weeks = getWeeks(start, end);
		expect(weeks.length).toBe(3);
	});

	it("should start from Monday of start date week", () => {
		const start = new Date(2024, 2, 13); // Wednesday
		const end = new Date(2024, 2, 20);
		const weeks = getWeeks(start, end);
		expect(weeks[0].getDate()).toBe(11); // Monday of that week
	});

	it("should return single week for same week dates", () => {
		const start = new Date(2024, 2, 11); // Monday
		const end = new Date(2024, 2, 15); // Friday
		const weeks = getWeeks(start, end);
		expect(weeks.length).toBe(1);
	});

	it("should handle month boundaries", () => {
		const start = new Date(2024, 2, 25); // Last week of March
		const end = new Date(2024, 3, 8); // First week of April
		const weeks = getWeeks(start, end);
		expect(weeks.length).toBe(3);
	});
});

describe("formatShortDate", () => {
	it("should format date with month abbreviation", () => {
		const date = new Date(2024, 2, 15);
		expect(formatShortDate(date)).toBe("15 Mar");
	});

	it("should handle single digit days", () => {
		const date = new Date(2024, 0, 5);
		expect(formatShortDate(date)).toBe("5 Jan");
	});

	it("should handle all months", () => {
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		months.forEach((month, index) => {
			const date = new Date(2024, index, 15);
			expect(formatShortDate(date)).toBe(`15 ${month}`);
		});
	});
});

describe("formatMonthYear", () => {
	it("should format month and year", () => {
		const date = new Date(2024, 2, 15);
		expect(formatMonthYear(date)).toBe("Mar 2024");
	});

	it("should handle all months", () => {
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		months.forEach((month, index) => {
			const date = new Date(2024, index, 15);
			expect(formatMonthYear(date)).toBe(`${month} 2024`);
		});
	});

	it("should handle different years", () => {
		const date = new Date(2025, 5, 15);
		expect(formatMonthYear(date)).toBe("Jun 2025");
	});
});

describe("formatDayName", () => {
	it("should return correct day names", () => {
		const sunday = new Date(2024, 2, 17);
		expect(formatDayName(sunday)).toBe("Sun");

		const monday = new Date(2024, 2, 18);
		expect
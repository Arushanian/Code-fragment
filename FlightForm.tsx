import React, { useEffect, useMemo, useState } from "react";
import {
  DatesWithPrices,
  DestinationCountry,
  SearchForm,
} from "@/types/appTypes";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { FlightSearchSchema } from "./flightSearch.Schema";
import { searchFormDefaultValues } from "@/constants/defaultValues";
import { ButtonMR } from "@/components/common/Button";
import { RadioButton } from "../buttons/RadioButton";
import {
  DatePicker,
  LocalizationProvider,
  PickersDay,
  PickersDayProps,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import Image from "next/image";
import Passangers from "./Passangers/Passangers";
import { Calendar } from "@/components/svgComponents/flightFinder/Calendar";
import dayjs, { Dayjs, locale } from "dayjs";
import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import { FLightLocationItem } from "./FLightLocationItem/FLightLocationItem";
import {
  ActionType,
  useBookFlight,
  useBookFlightDispatch,
} from "@/contexts/flight/BookFlightContext";
import { useGetFligthSearchCountriesInfo } from "@/services/flightSearch/useGetCountriesInfo";
import { getDatesInRange } from "@/utils/getDatesInRange";
import { useGetReturnDatesPrice } from "@/services/flightSearch/useGetReturnDatesPrice";
import { useSearchFlight } from "@/services/flightSearch/useSearchFlight";
import { useRouter } from "next/navigation";
import { filterDatesWithLowPrice } from "@/utils/filterDatesWithLowPrice";
import updateLocale from "dayjs/plugin/updateLocale";
import { deleteMaxDate } from "@/utils/deleteMaxDate";
import Loading from "@/components/common/Loading";
import { getMinDate } from "@/utils/getMinDate";

dayjs.extend(updateLocale);

dayjs.updateLocale("en", {
  weekStart: 1,
});

type Props = {
  isOnFlightResult?: boolean;
};

const FlightForm: React.FC<Props> = ({ isOnFlightResult }) => {
  const router = useRouter();

  const bookFlightContext = useBookFlight();
  const dispatch = useBookFlightDispatch();

  const searchFormFilledValues = {
    flightType: bookFlightContext?.searchDetails?.tripType,
    fromCountry: bookFlightContext.fromCountry,
    toCountry: bookFlightContext.toCountry || null,
    departureDate: bookFlightContext.searchDetails?.tourStartDate || null,
    returnDate: bookFlightContext.searchDetails?.tourEndDate || null,
    people: {
      adult: bookFlightContext.searchDetails?.travelersCount.adult,
      child: bookFlightContext.searchDetails?.travelersCount.child,
      infant: bookFlightContext.searchDetails?.travelersCount.infant,
    },
  };

  const initialSearchData = isOnFlightResult
    ? searchFormFilledValues
    : searchFormDefaultValues;

  const formProps = useForm<SearchForm>({
    resolver: yupResolver<SearchForm>(FlightSearchSchema),
    defaultValues: initialSearchData as SearchForm,
    mode: "onTouched",
  });
  const {
    control,
    watch,
    handleSubmit,
    resetField,
    formState: { errors },
  } = formProps;

  const [isOpenFirstDatePicker, setIsOpenFirstDatePicker] =
    useState<boolean>(false);
  const [isOpenSecondDatePicker, setIsOpenSecondDatePicker] =
    useState<boolean>(false);

  const minDate = watch("departureDate");
  const maxDate = watch("returnDate");
  const flightType = watch("flightType");

  const flightCountriesInfo = useGetFligthSearchCountriesInfo(flightType);

  const fromCountry = watch("fromCountry");
  const toCountry = watch("toCountry");

  const returnDatePrice = useGetReturnDatesPrice(
    toCountry,
    fromCountry,
    dayjs(minDate).isValid() ? dayjs(minDate).format("YYYY-MM-DD") : null
  );

  useEffect(() => {
    if (isOnFlightResult) {
      if (!fromCountry) {
        dispatch({
          type: ActionType.RESET_FROM_COUNTRY,
        });
        resetField("departureDate", { defaultValue: null });
        resetField("returnDate", { defaultValue: null });
      }

      if (!toCountry) {
        dispatch({
          type: ActionType.RESET_TO_COUNTRY,
        });
        resetField("departureDate", { defaultValue: null });
        resetField("returnDate", { defaultValue: null });
      }
    }
  }, [
    flightType,
    resetField,
    fromCountry,
    toCountry,
    isOnFlightResult,
    dispatch,
  ]);

  useEffect(() => {
    if (
      returnDatePrice.data?.date?.length ||
      returnDatePrice.data?.manual?.length
    ) {
      dispatch({
        type: ActionType.SET_RETURN_FLIGHT_ID,
        returnflightId: returnDatePrice.data?.manual.length
          ? returnDatePrice.data?.manual[0].flightId
          : returnDatePrice.data?.date[0].flightId,
      });
    }
  }, [returnDatePrice.data, dispatch]);

  const startDatePrices: DatesWithPrices[] = useMemo(() => {
    const allDatesWithPrice = toCountry?.date
      .reduce((dates: { day: Date; price: number }[], range) => {
        const singleDates = getDatesInRange(range);

        dates.push(...singleDates);

        return dates;
      }, [])
      .filter((item) => {
        return dayjs(item.day).isAfter(new Date());
      });

    const filteredPrices = filterDatesWithLowPrice(allDatesWithPrice || []);

    const result =
      flightType === "twoWay"
        ? toCountry?.date.map((item) => {
            return {
              day: item.startDate,
              price: 0,
            };
          })
        : filteredPrices;

    return result && result.length ? result : [];
  }, [toCountry, flightType]);

  const endDatePrices: DatesWithPrices[] = useMemo(() => {
    const manual = returnDatePrice.data?.manual.filter((item) => {
      if (
        dayjs(item.startDate).format("YYYY-MM-DD") ===
        dayjs(minDate).format("YYYY-MM-DD")
      ) {
        return item;
      }
    });

    return manual && manual.length
      ? manual.map((item) => {
          return {
            day: item.endDate,
            price: item.price,
          };
        })
      : [];
  }, [minDate, returnDatePrice.data?.manual]);

  const CustomStartDay:
    | React.ComponentType<PickersDayProps<dayjs.Dayjs>>
    | undefined = (pickersDayProps: PickersDayProps<Dayjs>) => {
    const stringifiedDate = dayjs(pickersDayProps.day).format("YYYY-MM-DD");
    return (
      <Box className="flex flex-col justify-center items-center relative">
        <PickersDay {...pickersDayProps} selected={!pickersDayProps.disabled} />
        {startDatePrices?.length
          ? startDatePrices.map((date) =>
              dayjs(date.day).format("YYYY-MM-DD") === stringifiedDate &&
              !pickersDayProps.outsideCurrentMonth &&
              date.price !== 0 ? (
                <Typography
                  key={date.day.toString()}
                  sx={{
                    position: "absolute",
                    top: "22px",
                    fontSize: "10px",
                    color: "#f5ce42",
                  }}
                >
                  {date.price}
                </Typography>
              ) : null
            )
          : null}
      </Box>
    );
  };

  const CustomEndDay:
    | React.ComponentType<PickersDayProps<dayjs.Dayjs>>
    | undefined = (pickersDayProps: PickersDayProps<Dayjs>) => {
    const stringifiedDate = dayjs(pickersDayProps.day).format("YYYY-MM-DD");
    return (
      <Box className="flex flex-col justify-center items-center relative">
        <PickersDay {...pickersDayProps} selected={!pickersDayProps.disabled} />
        {endDatePrices?.length
          ? endDatePrices.map((date) =>
              dayjs(date.day).format("YYYY-MM-DD") === stringifiedDate &&
              !pickersDayProps.outsideCurrentMonth &&
              dayjs(pickersDayProps.day).isAfter(minDate) ? (
                <Typography
                  key={date.day.toString()}
                  sx={{
                    position: "absolute",
                    top: "22px",
                    fontSize: "10px",
                    color: "#f5ce42",
                  }}
                >
                  {date.price}
                </Typography>
              ) : null
            )
          : null}
      </Box>
    );
  };

  const destinationOptions = (departureId: number) => {
    return departureId
      ? flightCountriesInfo?.data?.find((item) => item.id === departureId)
          ?.destination
      : [];
  };

  const flightListResponse = useSearchFlight({
    onSuccess: (searchResponse) => {
      dispatch({
        type: ActionType.SET_SEARCH_RESULT,
        searchResult: searchResponse,
      });
      router.push("/books/firstStage");
    },
  });

  const onSubmit = (data: SearchForm) => {
    flightListResponse.mutate({
      flightOneId: data.toCountry?.flightId || null,
      flightTwoId:
        flightType === "oneWay"
          ? null
          : bookFlightContext.flightDetails?.returnFlightId || null,
      startDate: dayjs(data.departureDate).format("YYYY-MM-DD"),
      returnedDate: data?.returnDate
        ? dayjs(data.returnDate).format("YYYY-MM-DD")
        : null,
      adult: data.people.adult,
      child: data.people.child,
      infant: data.people.infant,
    });

    dispatch({
      type: ActionType.ADD_SEARCH_PARAMS,
      searchData: {
        tripType: data.flightType,
        countryId: data.toCountry?.destinationCountryId || null,
        tourStartDate: dayjs(data.departureDate).format("YYYY-MM-DD"),
        tourEndDate: dayjs(data.returnDate).isValid()
          ? dayjs(data.returnDate).format("YYYY-MM-DD")
          : null,
        startFlightId: data.toCountry?.flightId || null,
        travelersCount: {
          adult: data.people.adult,
          child: data.people.child,
          infant: data.people.infant,
        },
      },
      fromCountry: data.fromCountry || undefined,
      toCountry: data.toCountry || undefined,
    });
  };

  return (
    <div
      className={`w-full max-w-container ${
        !isOnFlightResult && "mt-[33px]"
      } border border-white rounded-lg max-h-[132px] bg-soft_white`}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="pb-[20px] pt-[11px] px-[13px] relative">
            <div className="flex ">
              <RadioButton
                key="twoWayButton"
                name="flightType"
                label="Round Trip"
                value="twoWay"
                formProps={formProps}
                className={isOnFlightResult ? "text-black" : "text-white"}
              />
              <RadioButton
                key="oneWayButton"
                name="flightType"
                label="One way"
                value="oneWay"
                formProps={formProps}
                className={isOnFlightResult ? "text-black" : "text-white"}
              />
            </div>
            <div className="mt-[15px] h-[44px] flex flex-row justify-between">
              <label className="relative flex items-center focus-within:text-gray-600 ml-2.5">
                <Image
                  src="/icons/mapPin.svg"
                  alt="Map pin"
                  width={20}
                  height={20}
                  className="cursor-pointer absolute ml-[12px]"
                />
                <Controller
                  name="fromCountry"
                  control={control}
                  rules={{
                    required: true,
                  }}
                  render={({ field, ...props }) => {
                    return (
                      <Autocomplete
                        id="flightSearchAutocomplete1"
                        value={field.value}
                        ListboxProps={{
                          sx: {
                            padding: 0,
                          },
                        }}
                        slotProps={{
                          popper: {
                            modifiers: [{ name: "flip", enabled: false }],
                          },
                          paper: {
                            sx: {
                              width: "254px",
                              marginLeft: "-40px",
                              borderRadius: "12px",
                            },
                          },
                        }}
                        sx={{
                          " & *": {
                            cursor: "pointer",
                          },
                          "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline":
                            {
                              border: "none",
                            },
                        }}
                        className="rounded-md pl-[42px] w-[254px] flex items-center h-[44px] bg-super_light_gray placeholder:text-charcoal_grey text-charcoal_grey text-sm tracking-[0.28px] focus:outline-0 border-none"
                        options={flightCountriesInfo.data ?? []}
                        getOptionLabel={(option) => {
                          return option.departureCityName;
                        }}
                        renderInput={(params) => (
                          <TextField
                            className="placeholder:text-charcoal_grey"
                            placeholder={"From where?"}
                            {...params}
                          />
                        )}
                        renderOption={(props, option) =>
                          FLightLocationItem(props, option)
                        }
                        onChange={(e, data) => {
                          field.onChange(data);
                        }}
                      />
                    );
                  }}
                />
              </label>
              <label className="relative flex items-center focus-within:text-gray-600 ml-2.5">
                <Image
                  src="/icons/mapPin.svg"
                  alt="Map pin"
                  width={20}
                  height={20}
                  className="cursor-pointer absolute ml-[12px]"
                />
                <Controller
                  name="toCountry"
                  control={control}
                  rules={{
                    required: true,
                  }}
                  render={({ field, ...props }) => {
                    return (
                      <Autocomplete
                        id="flightSearchAutocomplete2"
                        value={field.value}
                        ListboxProps={{
                          sx: {
                            padding: 0,
                          },
                        }}
                        slotProps={{
                          popper: {
                            modifiers: [{ name: "flip", enabled: false }],
                          },
                          paper: {
                            sx: {
                              width: "254px",
                              marginLeft: "-40px",
                              borderRadius: "12px",
                            },
                          },
                        }}
                        onChange={(e, data: DestinationCountry | null) => {
                          field.onChange(data);
                        }}
                        sx={{
                          " & *": {
                            cursor: "pointer",
                            borderRadius: "0px !important",
                          },
                          "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline":
                            {
                              border: "none",
                            },
                        }}
                        className="rounded-md pl-[42px] w-[254px] flex items-center h-[44px] bg-super_light_gray placeholder:text-charcoal_grey text-charcoal_grey text-sm tracking-[0.28px] focus:outline-0 border-none"
                        options={
                          destinationOptions(Number(fromCountry?.id)) || []
                        }
                        getOptionLabel={(option: any) => {
                          if (
                            toCountry?.destinationCountryId ===
                            Number(fromCountry?.departureCountryId)
                          )
                            return "";
                          return option?.destinationCityName;
                        }}
                        renderOption={(props, option) =>
                          FLightLocationItem(props, option)
                        }
                        renderInput={(params) => (
                          <TextField
                            className="placeholder:text-charcoal_grey"
                            placeholder="To where?"
                            {...params}
                          />
                        )}
                      />
                    );
                  }}
                />
              </label>
              <div className="flex flex-row">
                <label className="relative flex items-center focus-within:text-gray-600 ml-2.5">
                  <Controller
                    name="departureDate"
                    control={control}
                    rules={{
                      required: true,
                      validate: {
                        required: (value) => dayjs(value)?.isBefore(maxDate),
                      },
                    }}
                    render={({ field }) => {
                      const validDate = dayjs(field.value).isValid()
                        ? dayjs(field.value)
                        : null;
                      return (
                        <DatePicker
                          shouldDisableDate={(date) => {
                            return !startDatePrices?.find(
                              (item) =>
                                date.format("YYYY-MM-DD") ===
                                dayjs(item.day).format("YYYY-MM-DD")
                            );
                          }}
                          defaultCalendarMonth={
                            flightType === "twoWay"
                              ? dayjs(getMinDate(startDatePrices))
                              : dayjs(startDatePrices[0]?.day)
                          }
                          value={validDate}
                          open={isOpenSecondDatePicker}
                          onClose={() => setIsOpenSecondDatePicker(false)}
                          slots={{
                            openPickerIcon: Calendar,
                            day: CustomStartDay,
                          }}
                          onChange={(date: Dayjs | null) => {
                            if (date?.isValid()) {
                              field.onChange(date);
                              resetField("returnDate");
                              dispatch({
                                type: ActionType.RESET_TOUR_END_DATE,
                              });
                            }
                          }}
                          sx={{
                            " & *": {
                              cursor: "pointer",
                            },
                            "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline":
                              {
                                border: "none",
                              },
                            "& .MuiInputBase-root": {
                              display: "flex",
                              flexDirection: "row-reverse",
                              height: "44px",
                              color: "#4F4F4F",
                            },
                            "& .MuiPickersCalendarHeader-label": {
                              textAlign: "center",
                            },
                          }}
                          className={`rounded-l-md h-11 w-[172px] bg-super_light_gray text-charcoal_grey placeholder:text-charcoal_grey text-sm tracking-[0.28px] focus:outline-0 cursor-pointer ${
                            flightType === "oneWay" ? "rounded-r-md" : null
                          }`}
                          slotProps={{
                            textField: {
                              placeholder: "Departure date",
                              onClick: () => {
                                setIsOpenSecondDatePicker(true);
                              },
                            },
                            popper: {
                              sx: { width: "343px" },
                              modifiers: [{ name: "flip", enabled: false }],
                            },
                            desktopPaper: {
                              sx: { marginTop: "8px", borderRadius: "12px" },
                            },
                          }}
                          disableHighlightToday
                          format="DD-MM-YYYY"
                        />
                      );
                    }}
                  />
                </label>
                <label className="relative flex items-center focus-within:text-gray-600">
                  {flightType === "twoWay" && (
                    <Controller
                      name="returnDate"
                      control={control}
                      rules={{
                        validate: {
                          required: (value) => dayjs(value)?.isAfter(minDate),
                        },
                      }}
                      render={({ field }) => {
                        const validDate = dayjs(field.value).isValid()
                          ? dayjs(field.value)
                          : null;
                        return (
                          <DatePicker
                            shouldDisableDate={(date) => {
                              return !endDatePrices?.find(
                                (item) =>
                                  date.format("YYYY-MM-DD") ===
                                  dayjs(item.day).format("YYYY-MM-DD")
                              );
                            }}
                            defaultCalendarMonth={dayjs(endDatePrices[0]?.day)}
                            slots={{
                              openPickerIcon: Calendar,
                              day: CustomEndDay,
                            }}
                            value={validDate}
                            open={isOpenFirstDatePicker}
                            onClose={() => setIsOpenFirstDatePicker(false)}
                            minDate={dayjs(minDate).add(1, "day")}
                            onChange={(date: Dayjs | null) => {
                              if (date?.isValid()) {
                                field.onChange(date);
                              }
                            }}
                            sx={{
                              " & *": {
                                cursor: "pointer",
                              },
                              "& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline":
                                {
                                  border: "none",
                                },
                              "& .MuiInputBase-root": {
                                display: "flex",
                                flexDirection: "row-reverse",
                                height: "44px",
                                color: "#4F4F4F",
                              },
                              "& .MuiPickersPopper-paper": {
                                marginTop: "8px",
                                borderRadius: "12px !important",
                              },
                            }}
                            className="rounded-r-md h-full w-[172px] bg-super_light_gray placeholder:text-charcoal_grey text-sm tracking-[0.28px] focus:outline-0 "
                            slotProps={{
                              textField: {
                                placeholder: "Return date",
                                onClick: () => {
                                  setIsOpenFirstDatePicker(true);
                                },
                              },
                              layout: {
                                sx: { borderRadius: "12px" },
                              },
                              popper: {
                                sx: { width: "343px" },
                                placement: "bottom-end",
                                modifiers: [{ name: "flip", enabled: false }],
                              },
                              desktopPaper: {
                                sx: {
                                  marginTop: "8px",
                                  borderRadius: "12px",
                                },
                              },
                            }}
                            disableHighlightToday
                            format="DD-MM-YYYY"
                          />
                        );
                      }}
                    />
                  )}
                </label>
              </div>
              <p
                className={`absolute top-2 text-red-700 text-sm font-black w-[130px] ${
                  isOnFlightResult ? "right-52" : "right-40"
                }`}
              >
                {!!errors.people && errors.people?.adult?.message
                  ? errors.people?.adult?.message
                  : errors.people?.message}
              </p>
              <label className="relative flex items-center focus-within:text-gray-600 ml-2.5">
                <Image
                  src="/icons/profile.svg"
                  alt="Profile"
                  width={20}
                  height={20}
                  className="cursor-pointer absolute ml-[12px] z-10"
                />
                <Passangers formProps={formProps} />
              </label>
              <ButtonMR type="submit" className="w-[149px]">
                Search
              </ButtonMR>
            </div>
          </div>
        </form>
      </LocalizationProvider>
      <Loading isLoading={flightListResponse.isLoading} />
    </div>
  );
};

export default FlightForm;

CC ?= cc
CFLAGS ?= -std=c11 -Os -Wall -Wextra -Werror -pedantic
BUILD ?= /tmp/ei-native-core-build
AVR_PREFIX ?= avr-
AVR_FLAGS = -std=c11 -mmcu=atmega328p -DF_CPU=16000000UL -Os -Wall -Wextra -Werror -fstack-usage
.PHONY: test sanitize avr clean
test: $(BUILD)/test_core $(BUILD)/test_limits
	$(BUILD)/test_core
	$(BUILD)/test_limits
$(BUILD)/test_core: ei_core.c ei_core.h test_core.c
	mkdir -p $(BUILD)
	$(CC) $(CFLAGS) ei_core.c test_core.c -o $@
$(BUILD)/test_limits: ei_core.c ei_core.h test_limits.c
	mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -DEI_MAX_EDGES=2 ei_core.c test_limits.c -o $@
sanitize:
	mkdir -p $(BUILD)
	$(CC) -std=c11 -O1 -g -Wall -Wextra -Werror -fsanitize=address,undefined -fno-omit-frame-pointer ei_core.c test_core.c -o $(BUILD)/test_core_sanitize
	ASAN_OPTIONS=detect_leaks=0 $(BUILD)/test_core_sanitize
avr:
	mkdir -p $(BUILD)/avr
	$(AVR_PREFIX)gcc $(AVR_FLAGS) -c ei_core.c -o $(BUILD)/avr/ei_core.o
	$(AVR_PREFIX)gcc $(AVR_FLAGS) -c firmware.c -o $(BUILD)/avr/firmware.o
	$(AVR_PREFIX)gcc -mmcu=atmega328p -Wl,-Map=$(BUILD)/avr/firmware.map $(BUILD)/avr/ei_core.o $(BUILD)/avr/firmware.o -o $(BUILD)/avr/firmware.elf
	$(AVR_PREFIX)objcopy -O ihex -R .eeprom $(BUILD)/avr/firmware.elf $(BUILD)/avr/firmware.hex
	$(AVR_PREFIX)size --format=avr --mcu=atmega328p $(BUILD)/avr/firmware.elf
clean:
	rm -f $(BUILD)/test_core $(BUILD)/test_core_sanitize

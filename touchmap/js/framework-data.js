// K3 Touch Definition & Category Framework, v0.1.
// Lifted from the 'Lists' sheet of the K3 Touch Mapping Template (rows 2-16 and the
// Detailed Categories block from row 22). Category names match the Observation Log
// drop-downs exactly, so exported rows drop straight into the workbook's Analysis SUMIFs.
// Edit this file to change the framework; everything else reads from it.

export const FRAMEWORK = {
  "zones": [
    "Preform feed",
    "Blow moulder",
    "Labeller",
    "Filler",
    "Capper",
    "Mixer / carbo",
    "CIP / utilities",
    "Coder",
    "Inspection / rejects",
    "Packer / shrink",
    "Palletiser",
    "Conveyors",
    "Line-side store",
    "Control room / office",
    "Other"
  ],
  "people": [
    "Op 1",
    "Op 2",
    "Op 3",
    "Op 4",
    "Shift leader",
    "Mechanic",
    "Electrician",
    "Quality / lab",
    "Warehouse / forklift",
    "Other"
  ],
  "routes": [
    "Automation",
    "Digitalisation",
    "Optimisation",
    "Keep as is",
    "To be decided"
  ],
  "categories": [
    {
      "code": "P1",
      "name": "P1: Changeover / format change",
      "short": "Changeover / format change",
      "planned": true,
      "types": [
        {
          "name": "Parts change",
          "touchType": "Physical",
          "guide": "Each format part (or matched part set) removed and refitted on any machine = 1 touch: blow moulds, star wheels, neck plates, centring bells, capper heads, labeller stations, packer and palletiser parts, guide rails. Log one row per machine: Count = number of parts, Duration = average minutes per part."
        },
        {
          "name": "Loading recipe",
          "touchType": "Information",
          "guide": "Each HMI or paper filled for the new SKU = 1 touch: recipe or format, pack or pallet pattern, release sheet signed later. The same recipe loaded on 4 machines = 4 touches; one push from a line master panel = 1 touch."
        },
        {
          "name": "Adjusting Brix",
          "touchType": "Information",
          "guide": "Each Brix correction entered at the mixer during the changeover = 1 touch. A second correction after a re-check is a new touch. Taking the sample is First-off checks."
        },
        {
          "name": "New SKU material swap & line clearance",
          "touchType": "Physical",
          "guide": "Removing the previous SKU's preforms, caps, labels and packaging and staging the new SKU's = 1 touch per zone cleared. A cap or label colour change is a new SKU, so it belongs here. Topping up for the running SKU is P7."
        }
      ]
    },
    {
      "code": "P2",
      "name": "P2: CIP and sanitation",
      "short": "CIP and sanitation",
      "planned": true,
      "types": [
        {
          "name": "CIP start, checks & records",
          "touchType": "Information",
          "guide": "Each HMI or paper act around a CIP, sanitising cycle or water flush = 1 touch: programme selected and started, parameter checked against spec, rinse water released, restart confirmed, CIP log signed. The cycle running on its own is not a touch."
        },
        {
          "name": "CIP set-up & strip-down",
          "touchType": "Physical",
          "guide": "Each route set-up (swing bends, flow plates, manual valves, CIP cups or dummy bottles) = 1 touch; putting it back afterwards = 1 more touch. Do not count each cup or bend."
        },
        {
          "name": "Chemical top-up / container change",
          "touchType": "Physical",
          "guide": "Each caustic, acid or sanitiser container change or top-up = 1 touch. Walking to the chemical store is part of the duration."
        },
        {
          "name": "Foam / wet cleaning (COP)",
          "touchType": "Physical",
          "guide": "Each foam or wet clean round on filler, capper or block enclosure = 1 touch per area cleaned. Spray, wait, rinse and wipe are one task. A wipe inside a CIL route stays in P6."
        },
        {
          "name": "Post-CIP rinse & swab sampling",
          "touchType": "Physical",
          "guide": "Each sampling event that verifies a CIP or sanitising just done (rinse water, ATP swab, micro sample) = 1 touch, including taking it to the lab. Scheduled swabs not tied to a CIP are P4."
        }
      ]
    },
    {
      "code": "P3",
      "name": "P3: Machine settings and adjustments",
      "short": "Machine settings and adjustments",
      "planned": true,
      "types": [
        {
          "name": "Blow moulder settings",
          "touchType": "Information",
          "guide": "Each oven profile, pre-blow or final-blow pressure change on the HMI for a normal reason (new preform lot, ambient temperature) = 1 touch. Because bottles came out defective: U3; because a lamp is out: U7."
        },
        {
          "name": "Filler, mixer capper set-points",
          "touchType": "Information",
          "guide": "Each fill level, CO2 volume or in-spec Brix trim changed during the run for a planned or normal reason = 1 touch. Brix at changeover is P1; a correction after an out-of-spec result is U5."
        },
        {
          "name": "labeller & coder settings",
          "touchType": "Information",
          "guide": "Each torque, glue temperature, vacuum, timing or code content value changed on the HMI for a planned or normal reason = 1 touch. Moving parts by hand because they drifted out of position is U7."
        },
        {
          "name": "Line speed & packer",
          "touchType": "Information",
          "guide": "Each planned speed change (ramp-up, matching the plan or downstream) or packer / shrink tunnel temperature, tension or speed change = 1 touch per HMI used. Slowing down to nurse a defective machine is U7."
        },
        {
          "name": "Palletizer Setting",
          "touchType": "Information",
          "guide": "Each planned speed change (ramp-up, matching the plan or downstream) or packer / shrink tunnel temperature, tension or speed change = 1 touch per HMI used. Slowing down to nurse a defective machine is U7."
        }
      ]
    },
    {
      "code": "P4",
      "name": "P4: Quality and food-safety checks",
      "short": "Quality and food-safety checks",
      "planned": true,
      "types": [
        {
          "name": "Brix / CO2 sampling & test",
          "touchType": "Physical",
          "guide": "Each sampling round (take the bottle, test it, note the result on the spot) = 1 touch. Keying the result later at a desk or PC is Recording QC results."
        },
        {
          "name": "Container & pack checks",
          "touchType": "Physical",
          "guide": "Each scheduled check round on bottles or packs taken from the line = 1 touch per check type: fill level or net content, closure torque and seal, bottle or preform quality, label and date code."
        },
        {
          "name": "Inspector function test (test bottles)",
          "touchType": "Physical",
          "guide": "Each run of reject test bottles through an inspector (empty bottle, fill level, cap) = 1 touch. A strong automation candidate. A failed test and its re-validation are U5."
        },
        {
          "name": "Hygiene & foreign-body rounds",
          "touchType": "Physical",
          "guide": "Each scheduled ATP or micro swab round not tied to a CIP, or each glass and brittle-plastic or foreign-body walk round = 1 touch."
        },
        {
          "name": "Production startup checks",
          "touchType": "Physical",
          "guide": "Each start-up check after changeover before release (fill level, torque, label, code, Brix sample) = 1 touch per check type. Signing the release sheet later counts on Loading recipe. Routine checks during the run are P4."
        },
        {
          "name": "Recording QC results & readings",
          "touchType": "Information",
          "guide": "Each time results are written or keyed into the QC sheet or LIMS as a separate act, or water treatment values (chlorine, ozone, conductivity) are read for the quality record = 1 touch. A number that already exists in a system is a digitalisation candidate."
        }
      ]
    },
    {
      "code": "P5",
      "name": "P5: Safety, BOS and standard routines",
      "short": "Safety, BOS and standard routines",
      "planned": true,
      "types": [
        {
          "name": "Pre-start & safety device checks",
          "touchType": "Physical",
          "guide": "Each start-of-shift safety round, scheduled functional test (light curtains, interlocks, e-stops) or emergency equipment check (eyewash, showers, extinguishers, spill kits) = 1 touch."
        },
        {
          "name": "LOTO for planned work",
          "touchType": "Physical",
          "guide": "Each isolation applied for any planned job (changeover, CIP, AM, PM) = 1 touch; each removal = 1 touch. LOTO for a breakdown is U1; for a defect repair, U7."
        },
        {
          "name": "Work permit",
          "touchType": "Information",
          "guide": "Each permit raised, signed or closed for planned work = 1 touch. A permit for a breakdown or a defect repair goes with U1 or U7."
        },
        {
          "name": "BOS / safety observation",
          "touchType": "Information",
          "guide": "Each behavioural safety observation done and logged = 1 touch."
        },
        {
          "name": "5S & dry housekeeping",
          "touchType": "Physical",
          "guide": "Each planned 5S round (sort, red tags, shadow boards, audit) or dry clean of floors and walkways = 1 touch per zone. Wet cleaning is P2; picking up fallen bottles is U2."
        }
      ]
    },
    {
      "code": "P6",
      "name": "P6: Autonomous & preventive maintenance",
      "short": "Autonomous & preventive maintenance",
      "planned": true,
      "types": [
        {
          "name": "CIL route (clean, inspect, lubricate)",
          "touchType": "Physical",
          "guide": "Each AM standard or CIL route completed = 1 touch, not each point. The clock runs from collecting the checklist to sign-off. Anything wrong you find and then fix or tag is U7."
        },
        {
          "name": "Planned PM job",
          "touchType": "Physical",
          "guide": "Each job the maintenance plan calls for on time or count, whatever the part's condition (wear part swap, filter change, overhaul, calibration) = 1 touch per person. Replaced early because wear was found: U7. After a failure: U1."
        },
        {
          "name": "AM readings & records",
          "touchType": "Information",
          "guide": "Each gauge, pressure or counter reading round for the AM sheet, or AM checklist, PM order or CMMS confirmation completed later or elsewhere = 1 touch. Writing up a defect is U7."
        }
      ]
    },
    {
      "code": "P7",
      "name": "P7: Material replenishment (same SKU)",
      "short": "Material replenishment (same SKU)",
      "planned": true,
      "types": [
        {
          "name": "Preform loading",
          "touchType": "Physical",
          "guide": "Each metallic box tipped into the preform hopper = 1 touch. Fetching it with a pallet jack is part of the duration."
        },
        {
          "name": "Closure / cap loading",
          "touchType": "Physical",
          "guide": "Each bag or box of caps loaded into the cap hopper = 1 touch."
        },
        {
          "name": "Label & film reel change",
          "touchType": "Physical",
          "guide": "Each label reel or shrink / stretch film reel changed, including the splice = 1 touch."
        },
        {
          "name": "Other packaging, consumables & waste",
          "touchType": "Physical",
          "guide": "Each refill or trip = 1 touch: cartons, trays, pads, slip-sheets, empty pallets, glue, ink and make-up; material fetched and staged for later; empty octabins, cores and packaging waste taken away. Emptying reject bins is U3."
        },
        {
          "name": "Material Return",
          "touchType": "Physical",
          "guide": "Each material returned = 1 touch"
        },
        {
          "name": "Calling for material",
          "touchType": "Information",
          "guide": "Each routine request to the warehouse (phone, radio or system) before material runs out = 1 touch. Chasing material that is late or missing is U4."
        }
      ]
    },
    {
      "code": "P8",
      "name": "P8: Information, reporting and coordination",
      "short": "Information, reporting and coordination",
      "planned": true,
      "types": [
        {
          "name": "Shift / production report",
          "touchType": "Information",
          "guide": "Each time the shift log or production report is filled in (paper or system) = 1 touch."
        },
        {
          "name": "System bookings & traceability",
          "touchType": "Information",
          "guide": "Each booking or record of consumption, finished pallets or material lot numbers (MES, SAP, Edge or paper) = 1 touch per booking session. Scrap and rejects are U3."
        },
        {
          "name": "Re-typing numbers (Excel, e-mail, chat)",
          "touchType": "Information",
          "guide": "Each time a value already recorded once is copied somewhere else = 1 touch per hand-off. One number handed on 4 times = 4 touches. QC and CIP results stay in P4 and P2."
        },
        {
          "name": "Handover, meetings & planned calls",
          "touchType": "Information",
          "guide": "Each shift handover, morning or tier meeting input, or planned coordination call (PM slot, QA release, next shift) = 1 touch per person. A call because something went wrong goes with that U category."
        },
        {
          "name": "Plan & SOP look-ups",
          "touchType": "Information",
          "guide": "Each check of the production plan, or look-up of a parameter, SOP or recipe value as a task of its own = 1 touch. A look-up in the middle of another task is part of that touch."
        }
      ]
    },
    {
      "code": "U1",
      "name": "U1: Equipment breakdowns",
      "short": "Equipment breakdowns",
      "planned": false,
      "types": [
        {
          "name": "Mechanical failure or major jam",
          "touchType": "Physical",
          "guide": "Each breakdown that stopped the machine (bearing, gripper, chain, gearbox, stretch rod, filling valve, capping head) or jam that needs a mechanic or runs past the threshold (suggested 10 min, set locally) = 1 touch per person responding."
        },
        {
          "name": "Electrical, pneumatic or drive failure",
          "touchType": "Physical",
          "guide": "Each motor, servo, drive, heater lamp, sensor, cable, or the machine's own valve, cylinder or air line failing and stopping it = 1 touch per person. A drop in the plant air supply is U6."
        },
        {
          "name": "Control / PLC / HMI fault",
          "touchType": "Information",
          "guide": "Each control fault cleared by a reset, reboot or software action that needs an electrician or automation engineer, or runs past the threshold = 1 touch per person. A quick reset the operator does alone is U2."
        },
        {
          "name": "LOTO & restart after repair",
          "touchType": "Physical",
          "guide": "Each isolation on and off for the repair = 1 touch each; each restart (re-threading, purging, wiping down, first-off checks) = 1 touch per person."
        },
        {
          "name": "Breakdown calls & records",
          "touchType": "Information",
          "guide": "Each call to maintenance, repair permit, CIP started because the repair opened the product path, or stop reason written or selected = 1 touch."
        }
      ]
    },
    {
      "code": "U2",
      "name": "U2: Process failures and micro-stops",
      "short": "Process failures and micro-stops",
      "planned": false,
      "types": [
        {
          "name": "Jam or pile-up cleared",
          "touchType": "Physical",
          "guide": "Each short stop the operator clears alone within the threshold = 1 touch: conveyor, preform or cap infeed, label web, transfer stars, packer or palletiser, film break, or a hand push to keep the flow going. Put the machine in Zone. If the material is faulty, it is U4. Repeats: 1 row with Count."
        },
        {
          "name": "Fallen bottles",
          "touchType": "Physical",
          "guide": "Each fallen bottle picked up and the flow restarted = 1 touch. Log 1 row with Count over the window: the frequency matters more than the 20 seconds each one takes."
        },
        {
          "name": "Blown / burst bottles",
          "touchType": "Physical",
          "guide": "Each burst or blown bottle cleared from the blow moulder, transfer or filler to restart the flow = 1 touch."
        },
        {
          "name": "Nuisance trip reset",
          "touchType": "Information",
          "guide": "Each nuisance alarm acknowledged and reset by the operator with no repair = 1 touch. Cleaning or re-aiming the sensor while the machine still runs is U7."
        },
        {
          "name": "Recording the stop reason",
          "touchType": "Information",
          "guide": "Each micro-stop reason written or selected = 1 touch. It exists only because of the stop, so it goes with the stop, not P8."
        }
      ]
    },
    {
      "code": "U3",
      "name": "U3: Product and pack defects",
      "short": "Product and pack defects",
      "planned": false,
      "types": [
        {
          "name": "Rejection handling",
          "touchType": "Physical",
          "guide": "Each rejection event handled (emptying the reject table or bin) = 1 touch, whatever the number of bottles."
        },
        {
          "name": "Defect removal by hand",
          "touchType": "Physical",
          "guide": "Each removal of defective bottles or packs the inspector did not reject = 1 touch: fill, label, code, closure, forming defects or damaged packs. Write the defect in Task description."
        },
        {
          "name": "Sorting, rework & pallet rework (no hold)",
          "touchType": "Physical",
          "guide": "Each sorting or rework job on a quantity of product, or each pallet re-wrapped or rebuilt, when no formal hold exists = 1 touch. With a hold, it is U5."
        },
        {
          "name": "Process correction after a defect",
          "touchType": "Information",
          "guide": "Each set-point changed because product or packs came out wrong, with no formal deviation = 1 touch. After an out-of-spec result it is U5; to live with an equipment defect, U7."
        },
        {
          "name": "Recording rejects / scrap",
          "touchType": "Information",
          "guide": "Each time reject or scrap quantities are counted and written or keyed = 1 touch."
        }
      ]
    },
    {
      "code": "U4",
      "name": "U4: Material problems",
      "short": "Material problems",
      "planned": false,
      "types": [
        {
          "name": "Preform problem",
          "touchType": "Physical",
          "guide": "Each preform problem the operator handles (wrong type or lot, wrong dimension, contamination, deformed) = 1 touch, whatever the quantity. Pulling the bad lot, loading a good one and taking the bad one to quarantine count on this row."
        },
        {
          "name": "Closure / cap problem",
          "touchType": "Physical",
          "guide": "Each problem with caps before they enter the capper (cracked, wrong colour, ovality, wrong lot) = 1 touch, however many caps. Capped bottles that come out wrong are U3."
        },
        {
          "name": "Label, film & packaging problem",
          "touchType": "Physical",
          "guide": "Each problem with label reels (bad splice, curl, wrong print), film, cartons, trays, pallets, slip-sheets, glue or ink that needs an intervention = 1 touch. A break on a good reel is U2."
        },
        {
          "name": "Syrup / ingredient problem",
          "touchType": "Information",
          "guide": "Each event where syrup or another ingredient is late, stops or is wrong and the line reacts (alarm, tank switch on the HMI) = 1 touch. Syrup is a material, so it is U4 even when the syrup room causes it."
        },
        {
          "name": "Chasing or reporting a material problem",
          "touchType": "Information",
          "guide": "Each call, system check or conversation to chase missing or late material, or to report bad material = 1 touch. Standing idle while waiting is not a touch; note the gap in Notes."
        }
      ]
    },
    {
      "code": "U5",
      "name": "U5: Quality deviation response",
      "short": "Quality deviation response",
      "planned": false,
      "types": [
        {
          "name": "Re-sample, re-test & re-validation",
          "touchType": "Physical",
          "guide": "Each re-sample and re-test after a failed check, or re-test of an inspector after a failed function test = 1 touch."
        },
        {
          "name": "Corrections after OOS",
          "touchType": "Information",
          "guide": "Each set-point corrected because a result was out of spec (Brix, CO2, fill level, torque), or repeat CIP started because a result failed = 1 touch per value or cycle."
        },
        {
          "name": "Hold, sorting & rework of held stock",
          "touchType": "Physical",
          "guide": "Each hold placed by tagging, moving or segregating pallets, or each sorting or rework job on stock under a formal hold = 1 touch."
        },
        {
          "name": "Glass / foreign-body incident clearance",
          "touchType": "Physical",
          "guide": "Each line clearance after a breakage or foreign-body find = 1 touch per zone cleared."
        },
        {
          "name": "Deviation records, investigation & QA calls",
          "touchType": "Information",
          "guide": "Each deviation form, NCR or system stock block, each investigation act (records, trends, interviews) or each call to QA for a ruling = 1 touch per person."
        }
      ]
    },
    {
      "code": "U6",
      "name": "U6: External and utility",
      "short": "External and utility",
      "planned": false,
      "types": [
        {
          "name": "Air, CO2, power or cooling drop",
          "touchType": "Physical",
          "guide": "Each drop in the plant's air (LP or HP), CO2, power or cooling supply handled at the line (clearing and restarting machines) = 1 touch per machine restarted. A fault in the machine's own valve or circuit is U1 or U7."
        },
        {
          "name": "Water, steam or IT unavailable",
          "touchType": "Information",
          "guide": "Each event where treated water, steam, hot water, MES or the network is unavailable or out of spec and the line reacts (alarm, check, manual fallback) = 1 touch."
        },
        {
          "name": "Downstream blockage (warehouse / forklift)",
          "touchType": "Physical",
          "guide": "Each event where the operator moves or stores finished pallets because they cannot leave the line = 1 touch."
        },
        {
          "name": "Short-notice plan change",
          "touchType": "Information",
          "guide": "Each short-notice plan change the line has to react to (re-sequencing, re-staging, extra checks) = 1 touch. If it brings a changeover forward, the changeover touches stay in P1."
        },
        {
          "name": "Reporting an outside problem",
          "touchType": "Information",
          "guide": "Each call or message to utilities, the warehouse, IT or planning about the problem = 1 touch."
        }
      ]
    },
    {
      "code": "U7",
      "name": "U7: Equipment defects",
      "short": "Equipment defects",
      "planned": false,
      "types": [
        {
          "name": "Defect tag, reporting & monitoring",
          "touchType": "Information",
          "guide": "Each defect written on a tag, logged or reported to maintenance, each repair permit, or each extra check on a known defect to see if it is getting worse = 1 touch. Spotting it during a CIL route is part of P6."
        },
        {
          "name": "Workaround on a running defect",
          "touchType": "Physical",
          "guide": "Each act that keeps a machine with a known defect running without fixing it (cloth or tray under a leak, manual push past a worn guide, blanking off a valve) = 1 touch per intervention. Repeats: 1 row with Count."
        },
        {
          "name": "Setting change for a defect",
          "touchType": "Information",
          "guide": "Each set-point changed or sensor re-taught on the HMI to live with or correct a known defect (slower speed, oven profile shifted because a lamp is out) = 1 touch. Normal setting changes are P3."
        },
        {
          "name": "Early fix: worn part, leak or loose part",
          "touchType": "Physical",
          "guide": "Each part replaced because wear or damage was found before it failed, each leak stopped, or each loose bolt, guard or bracket secured = 1 touch per person. LOTO on and off for the fix count here too. On the plan's schedule it is P6; after a failure, U1."
        },
        {
          "name": "Misalignment or sensor fixed",
          "touchType": "Physical",
          "guide": "Each guide rail, star wheel, labeller part, chain or belt put back into position or re-tensioned, or sensor or camera cleaned, re-aimed or replaced, before it stopped the machine = 1 touch per section. Format adjustment at changeover is P1."
        }
      ]
    }
  ]
};

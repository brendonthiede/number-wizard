import { MAP_BACKGROUND, REGIONS, type Region } from '../content/map';
import type { Quest } from '../content/quest1';
import { fogLine, questFor, regionProgress, regionState, RegionState } from '../game/map';
import type { SaveData } from '../storage/save';
import { art } from './art';
import { ScreenNav } from './ScreenNav';
import { useFocusOnMount } from './useFocusOnMount';

interface MapScreenProps {
  save: SaveData;
  onPick: (quest: Quest) => void;
  onTitle: () => void;
}

/** The line under a region's name: its progress while Open, "Complete", or why it is Fogged. */
function stateLine(save: SaveData, region: Region, state: RegionState): string {
  if (state === RegionState.Fogged) return fogLine(region);
  if (state === RegionState.Complete) return 'Complete';
  const p = regionProgress(save, region)!;
  return `${p.won} of ${p.total}`;
}

/**
 * The world Map: one hotspot per region over the map image. A Fogged region is disabled and says
 * why. Focus starts on the first Open region, or the last Complete one when none is Open.
 */
export function MapScreen({ save, onPick, onTitle }: MapScreenProps) {
  const states = REGIONS.map((r) => regionState(save, r));
  const firstOpen = states.indexOf(RegionState.Open);
  const focusIndex = firstOpen !== -1 ? firstOpen : states.lastIndexOf(RegionState.Complete);
  const focused = useFocusOnMount<HTMLButtonElement>();
  return (
    <main className="screen map">
      <div className="screen-body">
        <h1>Map</h1>
        <div className="map-panel" data-testid="map-panel" style={{ backgroundImage: `url(${art(`background/${MAP_BACKGROUND}`)})` }}>
          {REGIONS.map((r, i) => {
            const state = states[i]!;
            const quest = questFor(r);
            return (
              <button
                key={r.id}
                type="button"
                className={`region ${state}`}
                style={{ left: `${r.hotspot.left}%`, top: `${r.hotspot.top}%`, width: `${r.hotspot.width}%`, height: `${r.hotspot.height}%` }}
                disabled={state === RegionState.Fogged}
                ref={i === focusIndex ? focused : undefined}
                onClick={() => { if (quest) onPick(quest); }}
              >
                <span className="region-name">{r.name}</span>
                <span className="region-state">{stateLine(save, r, state)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ScreenNav>
        <button type="button" onClick={onTitle}>Title</button>
      </ScreenNav>
    </main>
  );
}

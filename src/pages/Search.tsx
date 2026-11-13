import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Map as MapIcon, Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import {
  fetchActiveAds,
  fetchAllAreas,
  fetchAllCategories,
  searchBusinesses,
} from '../lib/api';
import { useDebounce } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { updatePageSeo } from '../lib/seo';
import { getFavorites, toggleFavoriteId } from '../lib/offlineStorage';
import type { AdRow, AreaRow, CategoryRow } from '../types/database';
import type { BusinessPublicView, SearchFiltersState, SortOption } from '../types/directory';
import { AppShell } from '../components/layout/AppShell';
import { AdBanner } from '../components/directory/AdBanner';
import { BusinessCard } from '../components/directory/BusinessCard';
import {
  SearchFiltersModal,
  SearchFiltersPanel,
} from '../components/directory/SearchFilters';
import { BusinessCardSkeleton, EmptyState } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { Card, Container } from '../components/ui/Surface';
import { useToast } from '../components/ui/Toast';

function readFiltersFromParams(params: URLSearchParams): SearchFiltersState {
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    area: params.get('area') ?? '',
    open: params.get('open') === '1',
    verified: params.get('verified') === '1',
    offer: params.get('offer') === '1',
    rating: params.get('rating') ? Number(params.get('rating')) : null,
    delivery: params.get('delivery') === '1',
    sort: (params.get('sort') as SortOption) || 'relevance',
  };
}

export function Search() {
  const { lang, t } = useI18n();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState<SearchFiltersState>(() => readFiltersFromParams(params));
  const debouncedQ = useDebounce(filters.q, 300);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [sidebarAds, setSidebarAds] = useState<AdRow[]>([]);
  const [results, setResults] = useState<BusinessPublicView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const lastLoggedKeyRef = useRef<string>('');
  const geoAttemptedRef = useRef(false);

  const paramsKey = params.toString();
  useEffect(() => {
    const incoming = readFiltersFromParams(params);
    setFilters((prev) => {
      if (
        prev.q === incoming.q &&
        prev.category === incoming.category &&
        prev.area === incoming.area &&
        prev.open === incoming.open &&
        prev.verified === incoming.verified &&
        prev.offer === incoming.offer &&
        prev.rating === incoming.rating &&
        prev.delivery === incoming.delivery &&
        prev.sort === incoming.sort
      ) {
        return prev;
      }
      setPage(1);
      return incoming;
    });
  }, [paramsKey]);

  useEffect(() => {
    updatePageSeo({
      title: filters.q
        ? `Search "${filters.q}" — Hello Sadiqabad`
        : 'Search Sadiqabad Directory — Hello Sadiqabad',
      description: 'Search local businesses, clinics, shops, and services in Sadiqabad.',
      canonicalPath: '/search',
    });
  }, [filters.q]);

  useEffect(() => {
    Promise.all([
      fetchAllCategories(),
      fetchAllAreas(),
      fetchActiveAds('search_sidebar'),
    ]).then(([cats, ar, ads]) => {
      setCategories(cats);
      setAreas(ar);
      setSidebarAds(ads);
    });
  }, []);

  useEffect(() => {
    if (filters.sort === 'nearest' && !userCoords && !geoAttemptedRef.current) {
      geoAttemptedRef.current = true;
      if (!navigator.geolocation) {
        showToast('Geolocation not supported. Using Sadiqabad city center.', 'info');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          showToast('Location permission declined — sorting from Sadiqabad center.', 'info');
        }
      );
    }
  }, [filters.sort, userCoords, showToast]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (debouncedQ) nextParams.set('q', debouncedQ);
    if (filters.category) nextParams.set('category', filters.category);
    if (filters.area) nextParams.set('area', filters.area);
    if (filters.open) nextParams.set('open', '1');
    if (filters.verified) nextParams.set('verified', '1');
    if (filters.offer) nextParams.set('offer', '1');
    if (filters.rating) nextParams.set('rating', String(filters.rating));
    if (filters.delivery) nextParams.set('delivery', '1');
    if (filters.sort !== 'relevance') nextParams.set('sort', filters.sort);
    if (nextParams.toString() !== params.toString()) {
      setParams(nextParams, { replace: true });
    }

    const searchKey = JSON.stringify({
      q: debouncedQ.trim(),
      category: filters.category,
      area: filters.area,
      open: filters.open,
      verified: filters.verified,
      offer: filters.offer,
      rating: filters.rating,
      delivery: filters.delivery,
    });
    const shouldLog =
      page === 1 && Boolean(debouncedQ.trim()) && lastLoggedKeyRef.current !== searchKey;
    if (shouldLog) {
      lastLoggedKeyRef.current = searchKey;
    }

    setLoading(true);
    searchBusinesses(
      { ...filters, q: debouncedQ },
      { page, limit: 20, userCoords, logSearch: shouldLog }
    )
      .then((res) => {
        setResults((prev) =>
          page === 1
            ? res.items
            : [...prev, ...res.items.filter((item) => !prev.some((p) => p.id === item.id))]
        );
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [
    debouncedQ,
    filters.category,
    filters.area,
    filters.open,
    filters.verified,
    filters.offer,
    filters.rating,
    filters.delivery,
    filters.sort,
    page,
    userCoords,
  ]);

  const updateFilters = (patch: Partial<SearchFiltersState>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const resetFilters = () => {
    setPage(1);
    setFilters({
      q: '',
      category: '',
      area: '',
      open: false,
      verified: false,
      offer: false,
      rating: null,
      delivery: false,
      sort: 'relevance',
    });
  };

  return (
    <AppShell>
      <Container className="py-6 space-y-5">
        {/* Top Search Bar + Quick Pills */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-surface-container-lowest rounded-2xl border border-outline-variant/60 px-3 min-h-[48px] shadow-xs">
              <SearchIcon className="w-5 h-5 text-outline shrink-0" />
              <input
                type="text"
                value={filters.q}
                onChange={(e) => updateFilters({ q: e.target.value })}
                placeholder={t('hero.searchPlaceholder', 'Search shops, doctors, areas...')}
                aria-label="Search query"
                className="flex-1 bg-transparent border-0 outline-none px-2.5 text-sm text-on-surface min-w-0"
              />
              {filters.q && (
                <button
                  type="button"
                  aria-label="Clear search query"
                  onClick={() => updateFilters({ q: '' })}
                  className="p-1 text-outline hover:text-on-surface cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="md:hidden h-12 px-3.5 rounded-2xl bg-primary text-on-primary text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{t('filter.filters', 'Filters')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { key: 'open', label: t('filter.openNow', 'Open Now') },
              { key: 'verified', label: t('filter.verified', 'Verified') },
              { key: 'offer', label: t('filter.offers', 'Offers') },
              { key: 'delivery', label: t('filter.delivery', 'Delivery') },
            ].map((chip) => {
              const active = Boolean(filters[chip.key as keyof SearchFiltersState]);
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => updateFilters({ [chip.key]: !active })}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                    active
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-lowest text-on-surface border-outline-variant/50 hover:bg-surface-container-low'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Sidebar + Results */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <aside className="hidden md:block md:col-span-4 lg:col-span-3 space-y-4 sticky top-28">
            <Card className="p-4">
              <SearchFiltersPanel
                filters={filters}
                categories={categories}
                areas={areas}
                onChange={updateFilters}
                onReset={resetFilters}
              />
            </Card>
            {sidebarAds[0] && <AdBanner ad={sidebarAds[0]} />}
          </aside>

          <div className="md:col-span-8 lg:col-span-9 space-y-4">
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-on-surface-variant">
              <span>
                <strong className="text-on-surface tabular-nums">{total}</strong>{' '}
                {lang === 'ur'
                  ? 'نتائج صادق آباد میں دستیاب ہیں'
                  : `${total === 1 ? 'listing' : 'listings'} found in Sadiqabad`}
              </span>
              <Link
                to="/map"
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{lang === 'ur' ? 'نقشے پر دیکھیں' : 'Peek on City Map'}</span>
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <BusinessCardSkeleton key={i} />
                ))}
              </div>
            ) : results.length === 0 ? (
              <EmptyState
                title={lang === 'ur' ? 'کوئی متعلقہ کاروبار نہیں ملا' : 'No matching businesses found'}
                titleUr={lang === 'en' ? 'کوئی متعلقہ کاروبار نہیں ملا' : undefined}
                description={
                  lang === 'ur'
                    ? 'فلٹرز صاف کریں یا انگریزی/رومن اردو میں تلاش کریں (مثلاً hospital, biryani, mobile)۔'
                    : 'Try clearing a filter or searching in English/Roman Urdu (e.g. hospital, dawai, biryani, mobile).'
                }
                action={
                  <Button variant="outline" onClick={resetFilters}>
                    {lang === 'ur' ? 'تمام فلٹرز صاف کریں' : 'Reset All Filters'}
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {results.map((biz) => (
                  <BusinessCard
                    key={biz.id}
                    business={biz}
                    isSaved={favorites.includes(biz.id)}
                    onToggleSave={(id) => setFavorites(toggleFavoriteId(id))}
                  />
                ))}
              </div>
            )}

            {results.length < total && (
              <div className="pt-4 flex justify-center">
                <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
                  {t('action.loadMore', 'Load More Results')}
                </Button>
              </div>
            )}
          </div>
        </div>

        <SearchFiltersModal
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          filters={filters}
          categories={categories}
          areas={areas}
          onChange={updateFilters}
          onReset={resetFilters}
        />
      </Container>
    </AppShell>
  );
}

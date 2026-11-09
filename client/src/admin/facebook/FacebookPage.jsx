import React, { useState, useEffect, useRef } from 'react';
import {
  Share2,
  BookOpen,
  MessageSquare,
  Key,
  Settings
} from 'lucide-react';
import axios from 'axios';
import { useStore } from '../../shared/context/StoreContext';
import FacebookProductPicker from './components/FacebookProductPicker';
import FacebookCopyComposer from './components/FacebookCopyComposer';
import FacebookVisualStudio from './components/FacebookVisualStudio';
import FacebookPublishScheduleBar from './components/FacebookPublishScheduleBar';
import FacebookPostsTable from './components/FacebookPostsTable';
import FacebookPostPreviewModal from './components/FacebookPostPreviewModal';
import FacebookSetupGuideModal from './components/FacebookSetupGuideModal';
import FacebookApiSettingsModal from './components/FacebookApiSettingsModal';
import FacebookSmartAdRecommender from './components/FacebookSmartAdRecommender';
import SocialInboxPanel from './components/SocialInboxPanel';

const DEFAULT_PRESETS = [
  {
    id: 'urgent_fomo',
    label: '🔥 عرض ناري وخاطف',
    description: 'أسلوب حماسي يركز على ندرة الكمية وسرعة الشراء'
  },
  {
    id: 'friendly_egyptian',
    label: '🤝 ودود وقريب (لهجة مصرية)',
    description: 'أسلوب اجتماعي قريب من العميل باللهجة المصرية المحببة'
  },
  {
    id: 'luxury_prestige',
    label: '✨ فخم واحترافي',
    description: 'يبرز الفخامة، الجودة العالية، والتميز'
  },
  {
    id: 'tech_specs',
    label: '📊 تقني ومفصل بالمواصفات',
    description: 'يركز على المواصفات الفنية الدقيقة والأرقام'
  },
  {
    id: 'bundle_saver',
    label: '🎁 باكدج وعرض التوفير',
    description: 'مثالي عند اختيار عدة منتجات معاً في عرض واحد'
  },
  {
    id: 'short_punchy',
    label: '⚡ قصير ومباشر',
    description: 'بوست مختصر وسريع القراءة مع نقاط سريعة'
  }
];

export default function FacebookPage() {
  const { token, config, showToast } = useStore();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const studioTopRef = useRef(null);

  const isAiAvailable = config?.isAiAvailable !== false;
  const isImageAiAvailable = Boolean(config?.isImageAiAvailable);
  const isFacebookAvailable = Boolean(config?.isFacebookAvailable);

  // Active Tab: studio vs social inbox
  const [activeTab, setActiveTab] = useState('studio');
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);

  // Editing existing post state
  const [editingPostId, setEditingPostId] = useState(null);

  // 1. Product Filter & Server Pagination State (20 per page)
  const [categories, setCategories] = useState([]);
  const [categoryChildren, setCategoryChildren] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [stockFilter, setStockFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedSpecs, setSelectedSpecs] = useState([]);

  const [products, setProducts] = useState([]);
  const [tagsFacet, setTagsFacet] = useState([]);
  const [specsFacet, setSpecsFacet] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Selected Products for Post
  const [selectedProducts, setSelectedProducts] = useState([]);

  // 2. AI Post Copy Generation State
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [selectedPreset, setSelectedPreset] = useState('urgent_fomo');
  const [discountText, setDiscountText] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatingCopy, setGeneratingCopy] = useState(false);

  // Generated / Editable Post Fields & Visual Identity Texts
  const [postText, setPostText] = useState('');
  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [ctaText, setCtaText] = useState('');

  // 3. Visual / Image Creation State
  const [postImageCountMode, setPostImageCountMode] = useState('single');
  const [singleVisualTab, setSingleVisualTab] = useState('svg_template');
  const [svgTemplateId, setSvgTemplateId] = useState('modern_spotlight');

  // Single-mode image & Multi-mode Cover + Additional Images
  const [singlePostImage, setSinglePostImage] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [additionalImages, setAdditionalImages] = useState([]);

  // AI Image Generation Prompts & Options
  const [imageOverlayText, setImageOverlayText] = useState('');
  const [imageDesignPrompt, setImageDesignPrompt] = useState('');
  const [useAttachedImagesForAi, setUseAttachedImagesForAi] = useState(true);
  const [generatingAiImage, setGeneratingAiImage] = useState(false);
  const [generatingProductAiId, setGeneratingProductAiId] = useState(null);
  const [generatingAllProductsAi, setGeneratingAllProductsAi] = useState(false);
  const [perProductPrompts, setPerProductPrompts] = useState({});

  // Compute effective images list for the post
  const effectivePostImages =
    postImageCountMode === 'single'
      ? singlePostImage
        ? [singlePostImage]
        : []
      : [coverImage, ...additionalImages].filter(Boolean);

  // 4. Saving, Publishing & Scheduling State
  const [scheduledAtInput, setScheduledAtInput] = useState('');
  const [savingPost, setSavingPost] = useState(false);
  const [savedPosts, setSavedPosts] = useState([]);
  const [postsStatusFilter, setPostsStatusFilter] = useState('all');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [publishingPostId, setPublishingPostId] = useState(null);

  // Modals State
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [previewModalPost, setPreviewModalPost] = useState(null);

  // Load Categories, Presets, and Saved Posts on Mount
  useEffect(() => {
    if (!token) return;
    axios
      .get('/api/admin/categories', authHeader)
      .then((res) => setCategories(res.data?.categories || []))
      .catch(console.error);

    axios
      .get('/api/admin/facebook/presets', authHeader)
      .then((res) => {
        if (res.data?.presets?.length) setPresets(res.data.presets);
      })
      .catch(() => {});

    fetchSavedPosts();
  }, [token]);

  // Fetch Filtered Products with Server Pagination (20 per page)
  const fetchFilteredProducts = async (targetPage = page, append = false) => {
    if (!token) return;
    setLoadingProducts(true);
    try {
      const res = await axios.post(
        '/api/admin/products/filter',
        {
          categoryId: selectedCategory || undefined,
          search: search.trim() || undefined,
          tags: selectedTags,
          specFilters: selectedSpecs.filter((s) => s.values.length > 0),
          minPrice: minPrice !== '' ? Number(minPrice) : undefined,
          maxPrice: maxPrice !== '' ? Number(maxPrice) : undefined,
          stockFilter: stockFilter || undefined,
          includeInactive: false,
          sortBy,
          page: targetPage,
          pageSize: 20
        },
        authHeader
      );

      const fetched = res.data?.products || [];
      setProducts((prev) => (append ? [...prev, ...fetched] : fetched));
      setCategoryChildren(res.data?.categoryChildren || []);
      setTagsFacet(res.data?.tagsFacet || []);
      setSpecsFacet(res.data?.specsFacet || []);
      setTotalProducts(res.data?.total || 0);
      setPages(res.data?.pages || 1);
    } catch (err) {
      console.error('Error filtering products for FB studio:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchFilteredProducts(page, false);
  }, [token, selectedCategory, selectedTags, selectedSpecs, sortBy, stockFilter, page]);

  const fetchSavedPosts = async (statusFilter = postsStatusFilter) => {
    if (!token) return;
    setLoadingPosts(true);
    try {
      const res = await axios.get(
        `/api/admin/facebook/posts?status=${statusFilter}&limit=30`,
        authHeader
      );
      setSavedPosts(res.data?.posts || []);
    } catch (err) {
      console.error('Error loading saved FB posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    fetchSavedPosts(postsStatusFilter);
  }, [postsStatusFilter]);

  // Filter Handlers
  const handleSelectCategory = (catId) => {
    setSelectedCategory(catId);
    setSelectedSpecs([]);
    setSelectedTags([]);
    setPage(1);
  };

  const handleToggleTag = (tag) => {
    setPage(1);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  };

  const handleToggleSpecValue = (specKey, specVal) => {
    setPage(1);
    setSelectedSpecs((prev) => {
      const existing = prev.find((s) => s.spec === specKey);
      if (!existing) return [...prev, { spec: specKey, values: [specVal] }];
      const nextValues = existing.values.includes(specVal)
        ? existing.values.filter((v) => v !== specVal)
        : [...existing.values, specVal];
      return nextValues.length > 0
        ? prev.map((s) => (s.spec === specKey ? { spec: specKey, values: nextValues } : s))
        : prev.filter((s) => s.spec !== specKey);
    });
  };

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSearch('');
    setSortBy('latest');
    setStockFilter('');
    setMinPrice('');
    setMaxPrice('');
    setSelectedTags([]);
    setSelectedSpecs([]);
    setPage(1);
  };

  // Toggle Product Selection
  const toggleProductSelection = (prod) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p._id === prod._id);
      if (exists) {
        return prev.filter((p) => p._id !== prod._id);
      }
      const readableSpecs = {};
      Object.entries(prod.specs || {}).forEach(([k, v]) => {
        if (!v) return;
        const facetObj = specsFacet.find((sf) => sf.spec === k);
        const catSpecs = prod.categoryId?.specs || {};
        readableSpecs[facetObj?.label || catSpecs[k] || k] = v;
      });

      const enrichedProd = {
        ...prod,
        specs: Object.keys(readableSpecs).length > 0 ? readableSpecs : prod.specs || {}
      };
      return [...prev, enrichedProd];
    });
  };

  // Reset Studio Editor to Fresh State
  const handleResetStudioEditor = () => {
    setEditingPostId(null);
    setSelectedProducts([]);
    setSelectedPreset('urgent_fomo');
    setDiscountText('');
    setCustomPrompt('');
    setPostText('');
    setHeadline('');
    setSubheadline('');
    setBadgeText('');
    setCtaText('');
    setPostImageCountMode('single');
    setSingleVisualTab('svg_template');
    setSinglePostImage('');
    setCoverImage('');
    setAdditionalImages([]);
    setImageOverlayText('');
    setImageDesignPrompt('');
    setPerProductPrompts({});
    setScheduledAtInput('');
  };

  // Load/Restore a Saved Post into Studio for Editing
  const handleLoadPostIntoStudio = (post) => {
    setEditingPostId(post._id);

    const restoredProducts = [];
    if (Array.isArray(post.productIds) && post.productIds.length > 0 && typeof post.productIds[0] === 'object') {
      post.productIds.forEach((p) => {
        if (p && p._id) restoredProducts.push(p);
      });
    } else if (Array.isArray(post.productsSnapshot) && post.productsSnapshot.length > 0) {
      post.productsSnapshot.forEach((snap) => {
        restoredProducts.push({
          _id: snap._id,
          name: snap.name,
          price: snap.price,
          oldPrice: snap.oldPrice,
          categoryName: snap.categoryName,
          image: snap.image,
          images: snap.image ? [snap.image] : [],
          specs: snap.specs || {}
        });
      });
    }
    setSelectedProducts(restoredProducts);

    setSelectedPreset(post.preset || 'urgent_fomo');
    setDiscountText(post.discountText || '');
    setCustomPrompt(post.customPrompt || '');
    setPostText(post.postText || '');
    setHeadline(post.headline || '');
    setSubheadline(post.subheadline || '');
    setBadgeText(post.badgeText || '');
    setCtaText(post.ctaText || '');
    setImageOverlayText(post.imageOverlayText || post.headline || '');
    setImageDesignPrompt(post.imageDesignPrompt || '');
    setSvgTemplateId(post.svgTemplateId || 'modern_spotlight');
    setPerProductPrompts(post.perProductPrompts || {});

    const postImgs = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
    const savedMode =
      post.postImageCountMode || (postImgs.length > 1 ? 'multiple' : 'single');
    setPostImageCountMode(savedMode);

    if (savedMode === 'single') {
      setSinglePostImage(postImgs[0] || post.coverImage || '');
      if (post.visualMode === 'ai_generated' || post.visualMode === 'product_images') {
        setSingleVisualTab('ai_or_real_images');
      } else {
        setSingleVisualTab('svg_template');
      }
    } else {
      const mainCov = post.coverImage || postImgs[0] || '';
      const extras =
        Array.isArray(post.additionalImages) && post.additionalImages.length > 0
          ? post.additionalImages
          : postImgs.slice(mainCov ? 1 : 0);
      setCoverImage(mainCov);
      setAdditionalImages(extras);
    }

    if (post.scheduledAt) {
      setScheduledAtInput(new Date(post.scheduledAt).toISOString().slice(0, 16));
    } else {
      setScheduledAtInput('');
    }

    showToast('تم استرجاع جميع بيانات البوست في الاستوديو بالأعلى للتعديل عليها ✏️');
    if (studioTopRef.current) {
      studioTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Generate AI Copy
  const handleGenerateAiCopy = async () => {
    if (selectedProducts.length === 0) {
      showToast('يرجى اختيار منتج واحد على الأقل من القائمة أولاً', 'error');
      return;
    }

    setGeneratingCopy(true);
    try {
      const res = await axios.post(
        '/api/admin/facebook/generate-copy',
        {
          productIds: selectedProducts.map((p) => p._id),
          preset: selectedPreset,
          discountText: discountText.trim(),
          customPrompt: customPrompt.trim()
        },
        authHeader
      );

      if (res.data?.done) {
        setPostText(res.data.postText || '');
        setHeadline(res.data.headline || '');
        setSubheadline(res.data.subheadline || '');
        setBadgeText(res.data.badgeText || discountText || 'عرض خاص 🔥');
        setCtaText(res.data.ctaText || '');
        setImageOverlayText(res.data.headline || '');
        if (res.data.suggestedImagePrompt && !imageDesignPrompt) {
          setImageDesignPrompt(res.data.suggestedImagePrompt);
        }

        setPerProductPrompts((prev) => {
          const next = { ...prev };
          selectedProducts.forEach((p) => {
            if (!next[p._id]) {
              const specsText = Object.entries(p.specs || {})
                .slice(0, 3)
                .map(([k, v]) => `${k}: ${v}`)
                .join('، ');
              next[p._id] = `صورة إعلانية احترافية تبرز المنتج (${p.name}) بسعر ${p.price} ${
                config?.currency || 'ج.م'
              }${specsText ? ` ومواصفاته (${specsText})` : ''} مع إضاءة استوديو فخمة`;
            }
          });
          return next;
        });

        showToast('تم توليد نص البوست ونصوص الهوية البصرية بالذكاء الاصطناعي بنجاح! ✨');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'حدث خطأ أثناء توليد البوست الدعائي', 'error');
    } finally {
      setGeneratingCopy(false);
    }
  };

  // Generate AI Single/Multi Ad Image
  const handleGenerateAiAdImage = async ({ targetMode = postImageCountMode } = {}) => {
    if (!isImageAiAvailable) {
      showToast('مفتاح توليد الصور بالذكاء الاصطناعي غير مفعل في الإعدادات', 'error');
      return;
    }

    if (selectedProducts.length === 0 && !imageDesignPrompt.trim() && !singlePostImage) {
      showToast('يرجى اختيار منتج أو إدخال برومبت أو إرفاق صورة أولاً', 'error');
      return;
    }

    setGeneratingAiImage(true);
    try {
      let attachedUrls = [];
      if (useAttachedImagesForAi) {
        if (targetMode === 'single' && singlePostImage) {
          attachedUrls = [singlePostImage];
        } else if (targetMode === 'multiple' && additionalImages.length > 0) {
          attachedUrls = additionalImages;
        } else {
          attachedUrls = selectedProducts
            .map((p) => p.images?.[0] || p.image)
            .filter(Boolean);
        }
      }

      const res = await axios.post(
        '/api/admin/facebook/generate-image',
        {
          productIds: selectedProducts.map((p) => p._id),
          productImageUrls: attachedUrls,
          useAttachedImages: useAttachedImagesForAi,
          headline: headline.trim(),
          subheadline: subheadline.trim(),
          badgeText: badgeText.trim() || discountText.trim(),
          ctaText: ctaText.trim(),
          imageOverlayText: imageOverlayText.trim() || headline.trim(),
          discountText: discountText.trim(),
          designPrompt: imageDesignPrompt.trim(),
          themeColor: config?.primaryColor || '#1877F2',
          storeName: config?.storeName || 'المتجر العصري'
        },
        authHeader
      );

      if (res.data?.imageUrl) {
        if (targetMode === 'single') {
          setSinglePostImage(res.data.imageUrl);
          showToast('تم توليد صورة البوست بالذكاء الاصطناعي ورفعها على الكلاود بنجاح! 🎨');
        } else {
          setAdditionalImages((prev) => [...prev, res.data.imageUrl]);
          showToast('تم توليد الصورة الإضافية بالذكاء الاصطناعي وإضافتها لصور البوست بنجاح! 🎨');
        }
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر توليد الصورة بالذكاء الاصطناعي', 'error');
    } finally {
      setGeneratingAiImage(false);
    }
  };

  // Generate Single Product AI Image
  const handleGenerateSingleProductAiImage = async (prod) => {
    if (!isImageAiAvailable) {
      showToast('مفتاح توليد الصور بالذكاء الاصطناعي غير مفعل في الإعدادات', 'error');
      return;
    }

    setGeneratingProductAiId(prod._id);
    try {
      const prodImg = prod.images?.[0] || prod.image;
      const res = await axios.post(
        '/api/admin/facebook/generate-image',
        {
          productIds: [prod._id],
          productImageUrls: useAttachedImagesForAi && prodImg ? [prodImg] : [],
          useAttachedImages: useAttachedImagesForAi,
          headline: prod.name,
          subheadline: `${prod.price} ${config?.currency || 'ج.م'}`,
          badgeText: badgeText.trim() || discountText.trim() || 'عرض خاص',
          ctaText: ctaText.trim() || 'اطلب الآن',
          imageOverlayText: prod.name,
          discountText: discountText.trim(),
          designPrompt:
            perProductPrompts[prod._id] ||
            `صورة إعلانية جذابة للمنتج ${prod.name} بسعر ${prod.price} بإضاءة سينمائية احترافية`,
          themeColor: config?.primaryColor || '#1877F2',
          storeName: config?.storeName || 'المتجر العصري'
        },
        authHeader
      );

      if (res.data?.imageUrl) {
        setAdditionalImages((prev) => [...prev, res.data.imageUrl]);
        showToast(`تم توليد صورة مخصصة بالذكاء الاصطناعي للمنتج (${prod.name}) ورفعها للكلاود بنجاح! 🎨`);
      }
    } catch (err) {
      showToast(err.response?.data?.error || `تعذر توليد صورة للمنتج ${prod.name}`, 'error');
    } finally {
      setGeneratingProductAiId(null);
    }
  };

  // Generate AI Images for All Products
  const handleGenerateAllProductsAiImages = async () => {
    if (!isImageAiAvailable) {
      showToast('مفتاح توليد الصور بالذكاء الاصطناعي غير مفعل في الإعدادات', 'error');
      return;
    }

    if (selectedProducts.length === 0) {
      showToast('يرجى اختيار منتجات أولاً', 'error');
      return;
    }

    setGeneratingAllProductsAi(true);
    let successCount = 0;
    try {
      for (const prod of selectedProducts) {
        const prodImg = prod.images?.[0] || prod.image;
        try {
          const res = await axios.post(
            '/api/admin/facebook/generate-image',
            {
              productIds: [prod._id],
              productImageUrls: useAttachedImagesForAi && prodImg ? [prodImg] : [],
              useAttachedImages: useAttachedImagesForAi,
              headline: prod.name,
              subheadline: `${prod.price} ${config?.currency || 'ج.م'}`,
              badgeText: badgeText.trim() || discountText.trim() || 'عرض خاص',
              ctaText: ctaText.trim() || 'اطلب الآن',
              imageOverlayText: prod.name,
              discountText: discountText.trim(),
              designPrompt:
                perProductPrompts[prod._id] ||
                `صورة إعلانية جذابة للمنتج ${prod.name} بسعر ${prod.price}`,
              themeColor: config?.primaryColor || '#1877F2',
              storeName: config?.storeName || 'المتجر العصري'
            },
            authHeader
          );
          if (res.data?.imageUrl) {
            setAdditionalImages((prev) => [...prev, res.data.imageUrl]);
            successCount += 1;
          }
        } catch {
          // continue with others
        }
      }
      showToast(`تم بنجاح توليد ${successCount} صورة بالذكاء الاصطناعي للمنتجات المختارة! 🎉`);
    } finally {
      setGeneratingAllProductsAi(false);
    }
  };

  // Save / Update / Schedule / Publish Post
  const handleSaveOrUpdatePost = async ({
    publishNow = false,
    scheduleMode = false,
    forceNew = false
  } = {}) => {
    if (!postText.trim()) {
      showToast('يرجى إدخال نص البوست أولاً', 'error');
      return;
    }

    setSavingPost(true);
    try {
      let finalScheduledAt = null;
      if (scheduleMode && scheduledAtInput) {
        finalScheduledAt = new Date(scheduledAtInput).toISOString();
      }

      const productsSnapshot = selectedProducts.map((p) => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        oldPrice: p.oldPrice,
        categoryName: p.categoryId?.name || p.categoryName || '',
        image: p.images?.[0] || p.image || '',
        specs: p.specs || {}
      }));

      const payload = {
        productIds: selectedProducts.map((p) => p._id),
        productsSnapshot,
        preset: selectedPreset,
        discountText: discountText.trim(),
        customPrompt: customPrompt.trim(),
        postText: postText.trim(),
        headline: headline.trim(),
        subheadline: subheadline.trim(),
        badgeText: badgeText.trim(),
        ctaText: ctaText.trim(),
        imageOverlayText: imageOverlayText.trim() || headline.trim(),
        imageDesignPrompt: imageDesignPrompt.trim(),
        svgTemplateId,
        postImageCountMode,
        coverImage: postImageCountMode === 'multiple' ? coverImage : singlePostImage,
        additionalImages: postImageCountMode === 'multiple' ? additionalImages : [],
        images: effectivePostImages,
        perProductPrompts,
        scheduledAt: finalScheduledAt,
        publishNow
      };

      let res;
      if (editingPostId && !forceNew) {
        res = await axios.put(`/api/admin/facebook/posts/${editingPostId}`, payload, authHeader);
        showToast(publishNow ? 'تم نشر التعديلات على صفحة الفيسبوك بنجاح! 🚀' : 'تم حفظ تعديلات البوست بنجاح! ✅');
      } else {
        res = await axios.post('/api/admin/facebook/posts', payload, authHeader);
        showToast(publishNow ? 'تم نشر البوست على صفحة الفيسبوك بنجاح! 🚀' : 'تم إضافة وحفظ البوست بنجاح! ✅');
      }

      if (res.data?.post?._id) {
        setEditingPostId(res.data.post._id);
      }
      fetchSavedPosts();
    } catch (err) {
      showToast(err.response?.data?.error || 'حدث خطأ أثناء حفظ أو نشر المنشور', 'error');
    } finally {
      setSavingPost(false);
    }
  };

  // Publish existing post from list
  const handlePublishExistingPost = async (postId) => {
    setPublishingPostId(postId);
    try {
      const res = await axios.post(`/api/admin/facebook/posts/${postId}/publish`, {}, authHeader);
      showToast(res.data?.message || 'تم نشر البوست على صفحة فيسبوك بنجاح! 🚀');
      fetchSavedPosts();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر نشر البوست على صفحة فيسبوك', 'error');
    } finally {
      setPublishingPostId(null);
    }
  };

  // Confirm Reschedule from Table Modal
  const handleConfirmScheduleExistingPost = async (postId, modalDate) => {
    try {
      await axios.put(
        `/api/admin/facebook/posts/${postId}`,
        {
          scheduledAt: new Date(modalDate).toISOString()
        },
        authHeader
      );
      showToast('تمت جدولة موعد نشر البوست بنجاح ⏰');
      fetchSavedPosts();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر جدولة البوست', 'error');
    }
  };

  // Delete saved post
  const handleDeleteSavedPost = async (postId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا البوست نهائياً؟')) return;
    try {
      await axios.delete(`/api/admin/facebook/posts/${postId}`, authHeader);
      showToast('تم حذف المنشور بنجاح');
      if (editingPostId === postId) {
        handleResetStudioEditor();
      }
      fetchSavedPosts();
    } catch (err) {
      showToast(err.response?.data?.error || 'تعذر حذف المنشور', 'error');
    }
  };

  // Apply Smart AI Recommended Campaign into Studio
  const handleApplySmartCampaign = (campaignData) => {
    if (!campaignData) return;

    if (Array.isArray(campaignData.selectedProducts) && campaignData.selectedProducts.length > 0) {
      setSelectedProducts(campaignData.selectedProducts);
    }
    if (campaignData.preset) setSelectedPreset(campaignData.preset);
    if (campaignData.discountText !== undefined) setDiscountText(campaignData.discountText);
    if (campaignData.customPrompt !== undefined) setCustomPrompt(campaignData.customPrompt);

    if (campaignData.postText) setPostText(campaignData.postText);
    if (campaignData.headline) setHeadline(campaignData.headline);
    if (campaignData.subheadline) setSubheadline(campaignData.subheadline);
    if (campaignData.badgeText) setBadgeText(campaignData.badgeText);
    if (campaignData.ctaText) setCtaText(campaignData.ctaText);
    if (campaignData.headline) setImageOverlayText(campaignData.headline);
    if (campaignData.suggestedImagePrompt) setImageDesignPrompt(campaignData.suggestedImagePrompt);

    if (campaignData.svgTemplateId) setSvgTemplateId(campaignData.svgTemplateId);
    if (campaignData.perProductPrompts) setPerProductPrompts(campaignData.perProductPrompts);

    const prods = campaignData.selectedProducts || [];
    const hasMultiple = prods.length > 1;
    setPostImageCountMode(hasMultiple ? 'multiple' : 'single');

    if (hasMultiple) {
      const firstImg = prods[0]?.images?.[0] || prods[0]?.image || '';
      const otherImgs = prods.slice(1).map((p) => p.images?.[0] || p.image).filter(Boolean);
      if (firstImg) setCoverImage(firstImg);
      if (otherImgs.length > 0) setAdditionalImages(otherImgs);
    } else if (prods.length === 1) {
      const singleImg = prods[0]?.images?.[0] || prods[0]?.image || '';
      if (singleImg) setSinglePostImage(singleImg);
    }
  };

  return (
    <div ref={studioTopRef} className="space-y-6 animate-in fade-in text-ink">
      {/* Studio Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-line shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1877F2] text-white flex items-center justify-center shadow-md">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-ink">
                استوديو إعلانات وفيسبوك المتطور (Facebook AI Marketing Studio)
              </h3>
              <p className="text-xs text-ink-soft">
                اختر المنتجات، ولّد نص الإعلان، صمم بوسترات SVG أو صور الذكاء الاصطناعي، وانشر أو جدول بضغطة زر
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsApiSettingsOpen(true)}
            className={`text-xs font-black px-3 py-2 rounded-full border flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-all ${
              isFacebookAvailable
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                : 'bg-orange-500/10 text-orange-600 border-orange-500/30'
            }`}
            title="انقر لتهيئة مفاتيح الربط"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isFacebookAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500'
              }`}
            />
            <span>{isFacebookAvailable ? 'الفيسبوك متصل وجاهز' : 'الفيسبوك غير مهيأ بعد (انقر للربط)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsApiSettingsOpen(true)}
            className="px-4 py-2 rounded-btn bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
            title="إدخال معرف الصفحة وتوكن الوصول والـ Webhook"
          >
            <Key className="w-3.5 h-3.5" />
            <span>إعدادات وتوصيل الفيسبوك (Page ID & Token)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="px-3.5 py-2 rounded-btn bg-paper hover:bg-surface border border-line text-ink text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span>دليل الربط خطوة بخطوة</span>
          </button>
        </div>
      </div>

      {/* Subtab Navigation: Studio vs Social Inbox */}
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('studio')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all ${
            activeTab === 'studio'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-surface hover:bg-paper text-ink-soft hover:text-ink border border-line'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>استوديو وصانع المنشورات الإعلانية</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all ${
            activeTab === 'inbox'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-surface hover:bg-paper text-ink-soft hover:text-ink border border-line'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>صندوق المحادثات والرد الذكي بالـ AI (Social Inbox & Leads)</span>
        </button>
      </div>

      {activeTab === 'inbox' ? (
        <SocialInboxPanel onOpenSettings={() => setIsApiSettingsOpen(true)} />
      ) : (
        <>
          {/* Smart AI Ad Campaign Recommender from Platform Activity Signals */}
          <FacebookSmartAdRecommender
            onApplySmartCampaign={handleApplySmartCampaign}
            onOpenPreview={() =>
              setPreviewModalPost({
                _id: editingPostId || 'live-preview',
                postText,
                images: effectivePostImages,
                scheduledAt: scheduledAtInput || null,
                status: scheduledAtInput ? 'scheduled' : 'draft'
              })
            }
            currency={config?.currency || 'ج.م'}
          />

      {/* Step 1: Product Picker */}
      <FacebookProductPicker
        products={products}
        totalProducts={totalProducts}
        loadingProducts={loadingProducts}
        page={page}
        pages={pages}
        setPage={setPage}
        categories={categories}
        categoryChildren={categoryChildren}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        tagsFacet={tagsFacet}
        selectedTags={selectedTags}
        onToggleTag={handleToggleTag}
        specsFacet={specsFacet}
        selectedSpecs={selectedSpecs}
        onToggleSpecValue={handleToggleSpecValue}
        search={search}
        setSearch={setSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        onResetFilters={handleResetFilters}
        selectedProducts={selectedProducts}
        onToggleProductSelection={toggleProductSelection}
        onResetStudioEditor={handleResetStudioEditor}
        editingPostId={editingPostId}
        currency={config?.currency || 'ج.م'}
      />

      {/* Step 2: AI Ad Copy Composer */}
      <FacebookCopyComposer
        presets={presets}
        selectedPreset={selectedPreset}
        setSelectedPreset={setSelectedPreset}
        discountText={discountText}
        setDiscountText={setDiscountText}
        customPrompt={customPrompt}
        setCustomPrompt={setCustomPrompt}
        generatingCopy={generatingCopy}
        onGenerateCopy={handleGenerateAiCopy}
        selectedProducts={selectedProducts}
        isAiAvailable={isAiAvailable}
        postText={postText}
        setPostText={setPostText}
        headline={headline}
        setHeadline={setHeadline}
        subheadline={subheadline}
        setSubheadline={setSubheadline}
        badgeText={badgeText}
        setBadgeText={setBadgeText}
        ctaText={ctaText}
        setCtaText={setCtaText}
        setImageOverlayText={setImageOverlayText}
        showToast={showToast}
      />

      {/* Step 3: Visual Identity & Poster Studio */}
      <FacebookVisualStudio
        postImageCountMode={postImageCountMode}
        setPostImageCountMode={setPostImageCountMode}
        singleVisualTab={singleVisualTab}
        setSingleVisualTab={setSingleVisualTab}
        svgTemplateId={svgTemplateId}
        setSvgTemplateId={setSvgTemplateId}
        singlePostImage={singlePostImage}
        setSinglePostImage={setSinglePostImage}
        coverImage={coverImage}
        setCoverImage={setCoverImage}
        additionalImages={additionalImages}
        setAdditionalImages={setAdditionalImages}
        useAttachedImagesForAi={useAttachedImagesForAi}
        setUseAttachedImagesForAi={setUseAttachedImagesForAi}
        imageDesignPrompt={imageDesignPrompt}
        setImageDesignPrompt={setImageDesignPrompt}
        generatingAiImage={generatingAiImage}
        generatingProductAiId={generatingProductAiId}
        generatingAllProductsAi={generatingAllProductsAi}
        perProductPrompts={perProductPrompts}
        setPerProductPrompts={setPerProductPrompts}
        effectivePostImages={effectivePostImages}
        selectedProducts={selectedProducts}
        headline={headline}
        subheadline={subheadline}
        badgeText={badgeText}
        ctaText={ctaText}
        discountText={discountText}
        isImageAiAvailable={isImageAiAvailable}
        onGenerateAiAdImage={handleGenerateAiAdImage}
        onGenerateAllProductsAiImages={handleGenerateAllProductsAiImages}
        onGenerateSingleProductAiImage={handleGenerateSingleProductAiImage}
        onPreviewPost={() =>
          setPreviewModalPost({
            _id: editingPostId || 'live-preview',
            postText,
            images: effectivePostImages,
            scheduledAt: scheduledAtInput || null,
            status: scheduledAtInput ? 'scheduled' : 'draft'
          })
        }
        showToast={showToast}
        currency={config?.currency || 'ج.م'}
      />

      {/* Step 4: Publish & Schedule Bar */}
      <FacebookPublishScheduleBar
        editingPostId={editingPostId}
        savingPost={savingPost}
        postText={postText}
        scheduledAtInput={scheduledAtInput}
        setScheduledAtInput={setScheduledAtInput}
        isFacebookAvailable={isFacebookAvailable}
        onSaveOrUpdatePost={handleSaveOrUpdatePost}
        onOpenPreview={() =>
          setPreviewModalPost({
            _id: editingPostId || 'live-preview',
            postText,
            images: effectivePostImages,
            scheduledAt: scheduledAtInput || null,
            status: scheduledAtInput ? 'scheduled' : 'draft'
          })
        }
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Step 5: Saved Posts Table */}
      <FacebookPostsTable
        savedPosts={savedPosts}
        loadingPosts={loadingPosts}
        postsStatusFilter={postsStatusFilter}
        setPostsStatusFilter={setPostsStatusFilter}
        editingPostId={editingPostId}
        onLoadPostIntoStudio={handleLoadPostIntoStudio}
        onPreviewPost={(post) => setPreviewModalPost(post)}
        onPublishExistingPost={handlePublishExistingPost}
        onConfirmScheduleExistingPost={handleConfirmScheduleExistingPost}
        onDeleteSavedPost={handleDeleteSavedPost}
        publishingPostId={publishingPostId}
        isFacebookAvailable={isFacebookAvailable}
        showToast={showToast}
        currency={config?.currency || 'ج.م'}
      />
      </>
      )}

      {/* Realistic Facebook Post Preview Modal */}
      <FacebookPostPreviewModal
        post={previewModalPost}
        isOpen={Boolean(previewModalPost)}
        onClose={() => setPreviewModalPost(null)}
        onLoadIntoEditor={(postObj) => {
          if (postObj && postObj._id && postObj._id !== 'live-preview') {
            handleLoadPostIntoStudio(postObj);
          }
        }}
        storeName={config?.storeName || 'المتجر العصري'}
        storeLogo={config?.logo || ''}
      />

      {/* Facebook Setup Guide Modal */}
      <FacebookSetupGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Facebook API Credentials & Connection Modal */}
      <FacebookApiSettingsModal
        isOpen={isApiSettingsOpen}
        onClose={() => setIsApiSettingsOpen(false)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EditIcon, PackageIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import {
    createPharmacyProduct,
    deletePharmacyProduct,
    getMyPharmacyProducts,
    uploadFile,
    updatePharmacyProduct,
} from "../lib/api";
import { ImageUploadField } from "./OnboardingShared";

const emptyForm = {
    image: {},
    name: "",
    quantityValue: "",
    quantityUnit: "grams",
    stock: "",
    price: "",
    overTheCounter: true,
};

const currency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const ProductModal = ({ initialProduct, onClose }) => {
    const queryClient = useQueryClient();
    const [form, setForm] = useState(initialProduct ? {
        image: initialProduct.image || {},
        name: initialProduct.name || "",
        quantityValue: initialProduct.quantityValue || "",
        quantityUnit: initialProduct.quantityUnit || "grams",
        stock: initialProduct.stock ?? "",
        price: initialProduct.price ?? "",
        overTheCounter: Boolean(initialProduct.overTheCounter),
    } : emptyForm);

    const mutation = useMutation({
        mutationFn: async () => {
            let uploadedImage = form.image;
            if (form.image?.file) {
                try {
                    uploadedImage = (await uploadFile(form.image.file, "pharmacyProductImage")).data;
                } catch (error) {
                    const message = error?.response?.data?.message || error?.message || "Image upload failed";
                    if (message.includes("AWS_BUCKET_NAME")) {
                        throw new Error("Product image upload failed because the backend S3 bucket config is missing. Remove the image or restart the backend with AWS_BUCKET_NAME set.");
                    }
                    throw error;
                }
            }
            const uploaded = { ...form, image: uploadedImage };
            const payload = {
                ...uploaded,
                quantityValue: Number(uploaded.quantityValue),
                stock: Number(uploaded.stock),
                price: Number(uploaded.price),
                overTheCounter: Boolean(uploaded.overTheCounter),
            };
            return initialProduct
                ? updatePharmacyProduct({ productId: initialProduct._id, data: payload })
                : createPharmacyProduct(payload);
        },
        onSuccess: () => {
            toast.success(initialProduct ? "Product updated" : "Product added to shop");
            queryClient.invalidateQueries({ queryKey: ["my-pharmacy-products"] });
            onClose();
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not save product"),
    });

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const canSubmit = form.name.trim() && form.quantityValue !== "" && form.stock !== "" && form.price !== "";

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-lg">{initialProduct ? "Edit Product" : "Add Product"}</h2>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div className="min-h-[260px] space-y-2">
                        <ImageUploadField
                            label="Product Image"
                            field="pharmacyProductImage"
                            value={form.image}
                            onChange={(value) => update("image", value)}
                        />
                        <div className="h-8">
                            {(form.image?.file || form.image?.key) && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => update("image", {})}>
                                    Remove image
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="form-control">
                            <label className="label"><span className="label-text">Medicine Name</span></label>
                            <input className="input input-bordered" value={form.name} onChange={(e) => update("name", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Amount</span></label>
                                <input type="number" min="0" className="input input-bordered" value={form.quantityValue} onChange={(e) => update("quantityValue", e.target.value)} />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Unit</span></label>
                                <select className="select select-bordered" value={form.quantityUnit} onChange={(e) => update("quantityUnit", e.target.value)}>
                                    <option value="grams">Grams</option>
                                    <option value="pills">Number of pills</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Stock</span></label>
                                <input type="number" min="0" className="input input-bordered" value={form.stock} onChange={(e) => update("stock", e.target.value)} />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Price</span></label>
                                <input type="number" min="0" className="input input-bordered" value={form.price} onChange={(e) => update("price", e.target.value)} />
                            </div>
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Over the counter</span></label>
                            <div className="join">
                                <button type="button" className={`btn join-item flex-1 ${form.overTheCounter ? "btn-primary" : "btn-outline"}`} onClick={() => update("overTheCounter", true)}>Yes</button>
                                <button type="button" className={`btn join-item flex-1 ${!form.overTheCounter ? "btn-primary" : "btn-outline"}`} onClick={() => update("overTheCounter", false)}>No</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
                        {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : null}
                        {initialProduct ? "Save Product" : "Add to Shop"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PharmacyCataloguePage = () => {
    const [modalProduct, setModalProduct] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["my-pharmacy-products"],
        queryFn: getMyPharmacyProducts,
    });

    const deleteMutation = useMutation({
        mutationFn: deletePharmacyProduct,
        onSuccess: () => {
            toast.success("Product removed");
            queryClient.invalidateQueries({ queryKey: ["my-pharmacy-products"] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not remove product"),
    });

    const products = data?.data?.products ?? [];

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h1 className="text-2xl font-bold">Manage Catalogue</h1>
                <button className="btn btn-primary gap-2" onClick={() => setIsAdding(true)}>
                    <PlusIcon className="size-4" />
                    Add Product
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary" />
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-16 opacity-40">
                    <PackageIcon className="size-12 mx-auto mb-3" />
                    <p className="text-lg font-medium">No products yet</p>
                    <p className="text-sm">Add medicines to show them in your shop.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {products.map((product) => (
                        <div key={product._id} className="card bg-base-200 shadow-sm">
                            <div className="card-body">
                                <div className="flex gap-3">
                                    {product.image?.url ? (
                                        <img src={product.image.url} alt={product.name} className="size-20 rounded-lg object-cover" />
                                    ) : (
                                        <div className="size-20 rounded-lg bg-base-300 flex items-center justify-center">
                                            <PackageIcon className="size-8 opacity-50" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h2 className="font-semibold truncate">{product.name}</h2>
                                        <p className="text-sm opacity-60">{product.quantityValue} {product.quantityUnit}</p>
                                        <p className="font-bold">{currency(product.price)}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="badge badge-info">Stock {product.stock}</span>
                                    <span className={`badge ${product.overTheCounter ? "badge-success" : "badge-warning"}`}>
                                        {product.overTheCounter ? "OTC" : "Prescription"}
                                    </span>
                                </div>
                                <div className="card-actions justify-end">
                                    <button className="btn btn-ghost btn-sm gap-2" onClick={() => setModalProduct(product)}>
                                        <EditIcon className="size-4" />
                                        Edit
                                    </button>
                                    <button className="btn btn-error btn-sm gap-2" onClick={() => deleteMutation.mutate(product._id)} disabled={deleteMutation.isPending}>
                                        <Trash2Icon className="size-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isAdding && <ProductModal onClose={() => setIsAdding(false)} />}
            {modalProduct && <ProductModal initialProduct={modalProduct} onClose={() => setModalProduct(null)} />}
        </div>
    );
};

export default PharmacyCataloguePage;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../services/api';

// This interface now correctly defines `code` as optional
interface Branch {
  id: number;
  name: string;
  code?: string | null;
}

interface FormData {
  name: string;
  phone: string;
  branch_id: string;
  email: string;
  address: string;
  father_name: string;
  aadhar_number: string;
  registration_number: string;
}

const PublicStudentRegistration: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    branch_id: '',
    email: '',
    address: '',
    father_name: '',
    aadhar_number: '',
    registration_number: ''
  });
  // The state now uses the correct Branch interface
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const branchesData = await api.getPublicBranches();
        setBranches(branchesData);
        // This now correctly checks if branches exist and sets the ID from the FIRST branch
        if (branchesData.length > 0) {
          setFormData(prev => ({
            ...prev,
            branch_id: branchesData[0].id.toString()
          }));
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
        toast.error('Failed to load branches. Please try again later.');
      }
    };

    fetchBranches();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.branch_id) {
      toast.error('Please fill in all required fields: Name, Phone, and Branch');
      return;
    }

    setIsLoading(true);
    try {
      await api.registerPublicStudent({
        ...formData,
        branch_id: parseInt(formData.branch_id, 10)
      });
      toast.success('Registration successful! Thank you.');
      // This now correctly resets the form, including the default branch
      setFormData({
        name: '', phone: '', branch_id: branches.length > 0 ? branches[0].id.toString() : '', email: '',
        address: '', father_name: '', aadhar_number: '', registration_number: ''
      });
    } catch (error: any) {
      const errorMsg = error.message || 'Registration failed. Please try again.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyles = "mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-purple-500 focus:ring focus:ring-purple-500 focus:ring-opacity-50 text-base py-3 px-4";
  const labelStyles = "block text-sm font-medium text-gray-700";

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full mx-auto bg-white p-8 md:p-10 rounded-xl shadow-lg">
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">
            New Student Registration
            </h2>
            <p className="mt-2 text-sm text-gray-500">Please fill out the form to get registered.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelStyles}>
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={inputStyles}
                required
              />
            </div>

            <div>
              <label className={labelStyles}>
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={inputStyles}
                required
              />
            </div>
          </div>
          
          <div>
            <label className={labelStyles}>
              Branch <span className="text-red-500">*</span>
            </label>
            <select
              name="branch_id"
              value={formData.branch_id}
              onChange={handleChange}
              className={inputStyles}
              required
              disabled={branches.length === 0}
            >
              {branches.length === 0 ? (
                <option value="">Loading branches...</option>
              ) : (
                branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code || 'N/A'})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelStyles}>
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={inputStyles}
              />
            </div>

            <div>
              <label className={labelStyles}>
                Father's Name
              </label>
              <input
                type="text"
                name="father_name"
                value={formData.father_name}
                onChange={handleChange}
                className={inputStyles}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelStyles}>
                Aadhar Number
              </label>
              <input
                type="text"
                name="aadhar_number"
                value={formData.aadhar_number}
                onChange={handleChange}
                className={inputStyles}
              />
            </div>

            <div>
              <label className={labelStyles}>
                Registration Number
              </label>
              <input
                type="text"
                name="registration_number"
                value={formData.registration_number}
                onChange={handleChange}
                className={inputStyles}
              />
            </div>
          </div>

          <div>
            <label className={labelStyles}>
              Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className={inputStyles}
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-300"
            >
              {isLoading ? 'Submitting...' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PublicStudentRegistration;